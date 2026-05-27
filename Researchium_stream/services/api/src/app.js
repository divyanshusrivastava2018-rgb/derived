import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createCorsOptions } from '../../shared/cors.js';
import { rootRouter } from './routes/root.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { sessionRouter } from './routes/session.js';
import { studioRouter } from './routes/studio.js';
import { dashboardRouter } from './routes/dashboard.js';
import { researchersRouter } from './routes/researchers.js';
import { streamsRouter } from './routes/streams.js';
import { adminStudioUsersRouter } from './routes/admin-studio-users.js';
import { notFound, errorHandler } from './middleware/error-handler.js';
import { authRateLimit } from './middleware/auth-rate-limit.js';
import { isProduction } from '../../shared/env.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(createCorsOptions()));
  app.use(express.json({ limit: '32kb' }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: Number(process.env.API_RATE_LIMIT_MAX) || 100,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  if (isProduction()) {
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.path === '/health') return next();
      const origin = req.get('Origin');
      if (!origin) return res.status(403).json({ error: 'origin_required' });
      next();
    });
  }

  app.use(rootRouter);
  app.use(healthRouter);
  app.use(sessionRouter);
  app.use(authRouter);
  app.use(studioRouter);
  app.use(dashboardRouter);
  app.use(researchersRouter);
  app.use(streamsRouter);
  app.use(adminStudioUsersRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
