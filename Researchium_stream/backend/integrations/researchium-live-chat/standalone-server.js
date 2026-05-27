/**
 * Standalone Researchium live chat integration server.
 * Run: node integrations/researchium-live-chat/standalone-server.js
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { integrationConfig } from './config.js';
import { createResearchiumLiveChatIntegration } from './index.js';

if (!integrationConfig.enabled) {
  console.error('[researchium-chat] RESEARCHIUM_CHAT_ENABLED=0 — exiting');
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

const { router, startRetryWorker, stopRetryWorker } = createResearchiumLiveChatIntegration({ io });

app.use('/api/integrations/researchium/v1', router);

const port = Number(process.env.RESEARCHIUM_CHAT_PORT) || 5060;
const host = process.env.RESEARCHIUM_CHAT_HOST || '0.0.0.0';

httpServer.listen(port, host, () => {
  console.log(`[researchium-chat] http://${host}:${port}/api/integrations/researchium/v1/health`);
  startRetryWorker();
});

function shutdown() {
  stopRetryWorker();
  httpServer.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
