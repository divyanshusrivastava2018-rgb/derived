import { Router } from 'express';

export const rootRouter = Router();

rootRouter.get('/', (_req, res) => {
  res.json({
    name: 'Researchium Stream API',
    ok: true,
    docs: '/docs',
    health: '/health',
    endpoints: {
      login: 'POST /api/auth/login',
      register: 'POST /api/auth/register',
      me: 'GET /api/auth/me',
      studioStart: 'POST /api/studio/start',
      dashboard: 'GET /api/dashboard',
      openMeeting: 'POST /api/dashboard/meeting',
      streams: 'GET /api/streams',
    },
    hint: 'Open studio-lobby.html via a static server (port 5500), not this URL in the browser.',
  });
});

rootRouter.get('/docs', (_req, res) => {
  res.type('text/plain').send(
    'See docs/API.md in the repo.\n\n' +
      'Health:  GET /health\n' +
      'Login:   POST /api/auth/login  { email, password }\n' +
      'Studio:  POST /api/studio/start (Bearer token)\n'
  );
});
