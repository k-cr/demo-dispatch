import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { api } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  const corsOrigin =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map((s) => s.trim());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  if (env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      const t = Date.now();
      res.on('finish', () => {
        if (req.method !== 'GET' || res.statusCode >= 400)
          console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - t} ms)`);
      });
      next();
    });
  }

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
