import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { pool } from './db/connection';
import { version } from '../package.json';
import * as Sentry from '@sentry/node';
import { swaggerSpec } from './swagger';

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

  app.use('/api', routes);

  // ── Swagger UI ─────────────────────────────────────────────────────────────
  // Static assets (JS, CSS) are served freely so the browser can load them.
  // Only the root page checks the key, preventing unauthenticated spec discovery.
  app.use('/api-docs', swaggerUi.serve);

  app.get('/api-docs', (req: Request, res: Response, next: NextFunction) => {
    const docsKey = process.env.API_DOCS_KEY;
    const isDev   = config.nodeEnv !== 'production';
    const hasKey  = docsKey && (
      req.headers['x-api-docs-key'] === docsKey ||
      req.query['key'] === docsKey
    );
    if (isDev || hasKey) return next();
    res.status(404).json({ error: 'Not found' });
  }, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Bee Forest API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  app.use(notFound);
  Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}
