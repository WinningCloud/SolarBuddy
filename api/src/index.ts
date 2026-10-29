import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { config } from './config';
import { logger } from './logger';

const app = express();
app.use(cors({ origin: config.WEB_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
server.listen(config.API_PORT, () => {
  logger.info(`api listening on http://localhost:${config.API_PORT}`);
});
