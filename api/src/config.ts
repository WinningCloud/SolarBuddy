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
  LLM_PROVIDER: z.enum(['mock', 'anthropic']).default('mock'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  VOICE_PROVIDER: z.enum(['mock', 'elevenlabs']).default('mock'),
  ELEVENLABS_API_KEY: z.string().default(''),
  ELEVENLABS_VOICE_ID: z.string().default(''),
  NODE_ENV: z.string().default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
