import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

function int(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

export const integrationConfig = {
  enabled: process.env.RESEARCHIUM_CHAT_ENABLED !== '0',
  apiKey: process.env.RESEARCHIUM_INTEGRATION_API_KEY || process.env.API_KEY || '',
  webhookSecret: process.env.RESEARCHIUM_WEBHOOK_SECRET || '',
  databaseUrl: process.env.DATABASE_URL || process.env.RESEARCHIUM_CHAT_DATABASE_URL || '',
  store: process.env.RESEARCHIUM_CHAT_STORE || 'auto', // auto | postgres | memory
  coreApiUrl: process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000',
  webhookMaxAttempts: int('RESEARCHIUM_WEBHOOK_MAX_ATTEMPTS', 5),
  webhookRetryBaseMs: int('RESEARCHIUM_WEBHOOK_RETRY_BASE_MS', 1000),
  webhookRetryMaxMs: int('RESEARCHIUM_WEBHOOK_RETRY_MAX_MS', 60000),
  outboundMaxAttempts: int('RESEARCHIUM_OUTBOUND_MAX_ATTEMPTS', 3),
  outboundTimeoutMs: int('RESEARCHIUM_OUTBOUND_TIMEOUT_MS', 8000),
  messageMaxLength: int('RESEARCHIUM_MESSAGE_MAX_LENGTH', 2000),
  rateLimitPerMinute: int('RESEARCHIUM_CHAT_RATE_LIMIT', 120),
};

export function usePostgres() {
  if (integrationConfig.store === 'memory') return false;
  if (integrationConfig.store === 'postgres') return Boolean(integrationConfig.databaseUrl);
  return Boolean(integrationConfig.databaseUrl);
}
