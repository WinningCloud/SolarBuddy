import type { ZodType } from 'zod';
import { config } from '../../config';
import { logger } from '../../logger';

export type Slot = 'vision' | 'parse' | 'explain';

export class LlmError extends Error {
  constructor(
    public code: 'LLM_UNAVAILABLE' | 'LLM_CAP_REACHED' | 'LLM_FAILED' | 'LLM_BAD_OUTPUT',
    message: string,
  ) {
    super(message);
  }
}

const SLOT_MODEL: Record<Slot, () => string> = {
  vision: () => config.OPENROUTER_MODEL_VISION,
  parse: () => config.OPENROUTER_MODEL_PARSE,
  explain: () => config.OPENROUTER_MODEL_EXPLAIN,
};

let day = new Date().toDateString();
let calls = 0;
function countCall(): void {
  const today = new Date().toDateString();
  if (today !== day) {
    day = today;
    calls = 0;
  }
  if (calls >= config.LLM_DAILY_CALL_CAP) {
    throw new LlmError('LLM_CAP_REACHED', 'The daily model call limit was reached.');
  }
  calls++;
}

export function llmAvailable(slot: Slot): boolean {
  return (
    config.LLM_MODE === 'live' && Boolean(config.OPENROUTER_API_KEY) && Boolean(SLOT_MODEL[slot]())
  );
}

export function llmStatus() {
  return {
    mode: config.LLM_MODE,
    keyPresent: Boolean(config.OPENROUTER_API_KEY),
    models: {
      vision: config.OPENROUTER_MODEL_VISION || null,
      parse: config.OPENROUTER_MODEL_PARSE || null,
      explain: config.OPENROUTER_MODEL_EXPLAIN || null,
      fallback: config.OPENROUTER_MODEL_FALLBACK || null,
    },
    callsToday: calls,
    dailyCap: config.LLM_DAILY_CALL_CAP,
  };
}

interface JsonCall<T> {
  task: string;
  slot: Slot;
  system: string;
  userText: string;
  images?: string[];
  schema: ZodType<T>;
  /** Strict JSON schema sent as response_format where the model supports it. */
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

async function post(
  model: string,
  body: Record<string, unknown>,
): Promise<{ res: Response; json: ChatResponse }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.LLM_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.OPENROUTER_APP_URL,
        'X-Title': config.OPENROUTER_APP_NAME,
      },
      body: JSON.stringify({ model, ...body }),
    });
    const json = (await res.json().catch(() => ({}))) as ChatResponse;
    return { res, json };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const contentOf = (r: ChatResponse): string => r.choices?.[0]?.message?.content?.trim() ?? '';

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? body.slice(start, end + 1) : body);
}

/**
 * One typed model call: strict JSON schema when supported, JSON-only otherwise, zod validation,
 * one repair retry with the validation error, backoff on 429 and 5xx, then the fallback model.
 */
export async function callJson<T>(
  c: JsonCall<T>,
): Promise<{ data: T; model: string; latencyMs: number }> {
  if (!llmAvailable(c.slot)) {
    throw new LlmError('LLM_UNAVAILABLE', 'The language and vision model is not configured.');
  }
  const primary = SLOT_MODEL[c.slot]();
  const models = [primary, config.OPENROUTER_MODEL_FALLBACK].filter(
    (m, i, a) => m && a.indexOf(m) === i,
  );
  const started = Date.now();
  let lastError = 'unknown error';
  let badOutput = false;

  for (const model of models) {
    let useSchema = true;
    let repair: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      countCall();
      const userContent: unknown[] = [
        { type: 'text', text: repair ? `${c.userText}\n\n${repair}` : c.userText },
      ];
      for (const url of c.images ?? []) userContent.push({ type: 'image_url', image_url: { url } });
      const body: Record<string, unknown> = {
        max_tokens: c.maxTokens,
        temperature: 0,
        messages: [
          { role: 'system', content: c.system },
          { role: 'user', content: userContent },
        ],
      };
      if (useSchema) {
        body.response_format = {
          type: 'json_schema',
          json_schema: { name: c.task, strict: true, schema: c.jsonSchema },
        };
      }

      let result: { res: Response; json: ChatResponse };
      try {
        result = await post(model, body);
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'request failed';
        await sleep(400 * 2 ** attempt + Math.random() * 200);
        continue;
      }
      const { res, json } = result;
      if (res.status === 429 || res.status >= 500) {
        lastError = `${res.status} ${json.error?.message ?? ''}`.trim();
        await sleep(600 * 2 ** attempt + Math.random() * 300);
        continue;
      }
      if (res.status === 400 && useSchema) {
        // The model may not support strict json_schema: ask for JSON only instead.
        useSchema = false;
        attempt--;
        continue;
      }
      if (!res.ok) {
        lastError = `${res.status} ${json.error?.message ?? ''}`.trim();
        break;
      }
      try {
        const data = c.schema.parse(extractJson(contentOf(json)));
        const latencyMs = Date.now() - started;
        logger.info(
          {
            task: c.task,
            model,
            latencyMs,
            promptTokens: json.usage?.prompt_tokens,
            completionTokens: json.usage?.completion_tokens,
            images: c.images?.length ?? 0,
          },
          'llm call',
        );
        return { data, model, latencyMs };
      } catch (e) {
        badOutput = true;
        lastError = 'The model returned output that did not match the expected format.';
        repair = `Your previous reply was invalid: ${e instanceof Error ? e.message.slice(0, 400) : 'unparseable'}. Reply again with only valid JSON matching the schema.`;
      }
    }
  }
  logger.warn({ task: c.task, lastError }, 'llm call failed');
  throw new LlmError(badOutput ? 'LLM_BAD_OUTPUT' : 'LLM_FAILED', lastError);
}
