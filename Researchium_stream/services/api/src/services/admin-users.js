import { pool } from '../db/pool.js';
import * as devAuth from '../dev-auth.js';
import * as users from './users.js';

export async function assertDatabaseReady() {
  if (devAuth.devAuthEnabled()) {
    const ok = await devAuth.isDatabaseAvailable();
    if (!ok) {
      const err = new Error('database_unavailable');
      err.status = 503;
      throw err;
    }
  }
}

export function toPublicRow(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    institution: row.institution || null,
    createdAt: row.created_at,
  };
}

export async function listStudioUsers() {
  await assertDatabaseReady();
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.created_at, r.institution
     FROM users u
     LEFT JOIN researchers r ON r.id = u.researcher_id
     ORDER BY u.created_at DESC`
  );
  return rows.map(toPublicRow);
}

export async function createStudioUser({ email, password, name, institution }) {
  await assertDatabaseReady();
  const row = await users.register({ email, password, name, institution });
  const full = await users.findById(row.id);
  return users.publicUser(full);
}

export async function deleteStudioUser(userId) {
  await assertDatabaseReady();
  const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  if (!rowCount) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
}
