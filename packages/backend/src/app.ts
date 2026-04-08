import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { pool } from './db/connection';
import { version } from '../package.json';
import * as Sentry from '@sentry/node';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.get('/health', async (_req, res) => {
    const timestamp = new Date().toISOString();
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ok', database: 'connected', timestamp, version });
    } catch {
      res.status(503).json({ status: 'error', database: 'error', timestamp, version });
    }
  });

  app.get('/health/sentry-test', (_req, _res, next) => {
    next(new Error('Sentry test error - Bee Forest Backend'));
  });

  app.use('/api', routes);

  app.use(notFound);
  Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}
