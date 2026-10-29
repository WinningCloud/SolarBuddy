import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { config } from './config';
import { logger } from './logger';
import { llmStatus } from './integrations/llm/openrouter';
import { composerRouter } from './routes/composer';
import { errorHandler, visionRouter } from './routes/vision';

const app = express();
// Allowed browser origins: WEB_ORIGIN (comma separated) plus any localhost / 127.0.0.1 port, so the
// app works whichever way it is opened during development.
const allowed = config.WEB_ORIGIN.split(',').map((o) => o.trim());
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
app.use(
  cors({
    origin: (origin, cb) =>
      cb(null, !origin || allowed.includes(origin) || localOrigin.test(origin)),
  }),
);
app.use(express.json({ limit: '1mb' }));
// Image bytes are never logged: only the request line and status.
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (r) => ({ id: r.id, method: r.method, url: r.url }),
      res: (r) => ({ statusCode: r.statusCode }),
    },
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Integration status without any secrets.
app.get('/health/integrations', (_req, res) => {
  const s = llmStatus();
  res.json({ llm: { ...s, ready: s.mode === 'live' && s.keyPresent && Boolean(s.models.vision) } });
});

app.use('/vision', visionRouter);
app.use('/composer', composerRouter);
app.use(errorHandler);

const server = http.createServer(app);
server.listen(config.API_PORT, () => {
  logger.info(`api listening on http://localhost:${config.API_PORT}`);
});
