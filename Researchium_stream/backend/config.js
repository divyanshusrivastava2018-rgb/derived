import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  host: process.env.STUDIO_BACKEND_HOST || process.env.HOST || '127.0.0.1',
  port: Number(process.env.STUDIO_BACKEND_PORT) || 5050,
  apiUrl: process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000',
  signalingUrl: process.env.SIGNALING_INTERNAL_URL || 'http://127.0.0.1:4001',
  metricsPort: Number(process.env.STUDIO_METRICS_PORT) || 5051,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me-before-any-shared-network-use',
};
