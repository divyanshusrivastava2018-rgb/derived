import { createApp } from './app.js';
import { getHost } from '../../shared/env.js';

const PORT = Number(process.env.API_PORT) || 4000;
const app = createApp();
const host = getHost();

app.listen(PORT, host, () => {
  console.log(`[api] backend http://${host}:${PORT}`);
  console.log(
    '[api] routes: /health /api/auth/login /api/auth/me /api/studio/start /api/streams …'
  );
});
