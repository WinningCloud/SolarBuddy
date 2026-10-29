import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(repoRoot, '.env') });

const schema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URL: z.string().default(''),
  // 127.0.0.1, not localhost: Node may resolve localhost to ::1 while uvicorn listens on IPv4.
  SIM_URL: z.string().url().default('http://127.0.0.1:8000'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATA_DIR: z.string().default(path.join(repoRoot, 'data')),
  NODE_ENV: z.string().default('development'),

  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_APP_URL: z.string().default('http://localhost:5173'),
  OPENROUTER_APP_NAME: z.string().default('SecondSun'),
  OPENROUTER_MODEL_VISION: z.string().default(''),
  OPENROUTER_MODEL_PARSE: z.string().default(''),
  OPENROUTER_MODEL_EXPLAIN: z.string().default(''),
  OPENROUTER_MODEL_FALLBACK: z.string().default(''),
  LLM_MODE: z.enum(['live', 'cache', 'mock']).default('mock'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  LLM_DAILY_CALL_CAP: z.coerce.number().int().positive().default(2000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
