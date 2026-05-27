import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import * as devAuth from '../dev-auth.js';
import { assertPassword } from '../../../shared/validate.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createDbResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return token;
}

export async function issuePasswordReset(email) {
  const normalized = email.trim().toLowerCase();
  if (devAuth.devAuthEnabled() && !(await devAuth.isDatabaseAvailable())) {
    return devAuth.createDevPasswordReset(normalized);
  }
  try {
    const { rows } = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [
      normalized,
    ]);
    if (!rows[0]) return null;
    return createDbResetToken(rows[0].id);
  } catch (e) {
    if (devAuth.devAuthEnabled() && devAuth.isDbConnectionError(e)) {
      devAuth.markDatabaseUnavailable();
      return devAuth.createDevPasswordReset(normalized);
    }
    throw e;
  }
}

export async function completePasswordReset(token, newPassword) {
  assertPassword(newPassword);
  if (!token || typeof token !== 'string') {
    const err = new Error('invalid_reset_token');
    err.status = 400;
    throw err;
  }
  const tokenHash = hashToken(token);

  if (devAuth.devAuthEnabled()) {
    const devResult = await devAuth.consumeDevPasswordReset(token, newPassword);
    if (devResult) return devResult;
    if (!(await devAuth.isDatabaseAvailable())) {
      const err = new Error('invalid_reset_token');
      err.status = 400;
      throw err;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [tokenHash]
    );
    if (!rows[0]) {
      const err = new Error('invalid_reset_token');
      err.status = 400;
      throw err;
    }
    const hash = await bcrypt.hash(String(newPassword), 12);
    await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      hash,
      rows[0].user_id,
    ]);
    await client.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
      [rows[0].id]
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL AND id <> $2`,
      [rows[0].user_id, rows[0].id]
    );
    await client.query('COMMIT');
    return rows[0].user_id;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
