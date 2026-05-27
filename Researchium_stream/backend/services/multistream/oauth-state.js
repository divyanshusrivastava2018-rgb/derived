import jwt from 'jsonwebtoken';
import { config } from '../../config.js';

const ISSUER = 'researchium-multistream';

export function signOAuthState({ userId, platform }) {
  return jwt.sign(
    { userId, platform, purpose: 'oauth' },
    config.jwtSecret,
    { expiresIn: '15m', issuer: ISSUER }
  );
}

export function verifyOAuthState(state) {
  return jwt.verify(state, config.jwtSecret, { issuer: ISSUER });
}
