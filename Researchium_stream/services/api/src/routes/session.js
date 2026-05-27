import { Router } from 'express';
import { signSessionToken } from '../../../shared/auth.js';
import { assertEmail } from '../../../shared/validate.js';
import { isProduction } from '../../../shared/env.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireUser } from '../middleware/require-user.js';
import {
  authRateLimit,
  passwordResetRateLimit,
} from '../middleware/auth-rate-limit.js';
import * as users from '../services/users.js';
import * as passwordReset from '../services/password-reset.js';
import * as devAuth from '../dev-auth.js';

export const sessionRouter = Router();

const SESSION_TTL_SEC = 604800;

function sessionPayload(row) {
  const user = users.publicUser(row);
  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
  });
  return { user, token, expiresIn: SESSION_TTL_SEC };
}

sessionRouter.post(
  '/api/auth/register',
  authRateLimit,
  asyncHandler(async (req, res) => {
    if (process.env.STUDIO_ALLOW_PUBLIC_REGISTER !== '1') {
      return res.status(403).json({
        error: 'registration_disabled',
        message: 'Studio accounts are created by your site administrator.',
      });
    }
    const { email, password, name, institution } = req.body || {};
    const row = await users.register({ email, password, name, institution });
    const full = await users.findById(row.id);
    res.status(201).json(sessionPayload(full));
  })
);

sessionRouter.post(
  '/api/auth/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const row = await users.verifyLogin(email, password);
    res.json(sessionPayload(row));
  })
);

sessionRouter.get(
  '/api/auth/me',
  requireUser,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

sessionRouter.patch(
  '/api/auth/me',
  requireUser,
  asyncHandler(async (req, res) => {
    const row = await users.updateProfile(req.user.id, {
      name: req.body?.name,
      institution: req.body?.institution,
    });
    res.json({ user: users.publicUser(row) });
  })
);

sessionRouter.post(
  '/api/auth/refresh',
  requireUser,
  asyncHandler(async (req, res) => {
    const row = await users.findById(req.user.id);
    if (!row) return res.status(401).json({ error: 'unauthorized' });
    res.json(sessionPayload(row));
  })
);

sessionRouter.post(
  '/api/auth/logout',
  (_req, res) => {
    res.status(204).end();
  }
);

sessionRouter.post(
  '/api/auth/change-password',
  authRateLimit,
  requireUser,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'password_fields_required' });
    }
    await users.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ ok: true });
  })
);

sessionRouter.post(
  '/api/auth/forgot-password',
  passwordResetRateLimit,
  asyncHandler(async (req, res) => {
    const email = req.body?.email;
    if (!email) {
      return res.status(400).json({ error: 'email_required' });
    }
    let normalized;
    try {
      normalized = assertEmail(email);
    } catch {
      return res.json({
        ok: true,
        message: 'If that email is registered, you will receive reset instructions shortly.',
      });
    }

    const token = await passwordReset.issuePasswordReset(normalized);
    const origin =
      req.body?.origin ||
      req.get('origin') ||
      (devAuth.devAuthEnabled() ? 'http://127.0.0.1:5500' : '');

    if (token && devAuth.devAuthEnabled()) {
      console.log(
        `[auth] Password reset (dev): ${origin}/studio-lobby.html?reset=${token}`
      );
    }

    const body = {
      ok: true,
      message: 'If that email is registered, you will receive reset instructions shortly.',
    };
    if (token && devAuth.devAuthEnabled() && origin) {
      body.resetLink = `${origin.replace(/\/$/, '')}/studio-lobby.html?reset=${token}`;
    }
    if (token && !isProduction() && process.env.LOG_RESET_LINKS === '1') {
      console.log(`[auth] reset link: ${body.resetLink || token}`);
    }
    res.json(body);
  })
);

sessionRouter.post(
  '/api/auth/reset-password',
  passwordResetRateLimit,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: 'token_password_required' });
    }
    const userId = await passwordReset.completePasswordReset(token, password);
    const row = await users.findById(userId);
    if (!row) return res.status(400).json({ error: 'invalid_reset_token' });
    res.json(sessionPayload(row));
  })
);
