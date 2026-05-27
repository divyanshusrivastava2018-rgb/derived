import crypto from 'crypto';
import { ValidationError } from './errors.js';

export function signPayload(secret, payload) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyWebhookSignature(secret, rawBody, signatureHeader) {
  if (!secret) {
    throw new ValidationError('Webhook secret not configured');
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    throw new ValidationError('Missing X-Researchium-Signature header');
  }

  const expected = signPayload(secret, rawBody);
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();

  const a = Buffer.from(provided, provided.length === 64 ? 'hex' : 'utf8');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ValidationError('Invalid webhook signature');
  }
}
