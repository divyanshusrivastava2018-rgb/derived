import pg from 'pg';
import { requireEnv, isProduction } from '../../../shared/env.js';

export const pool = new pg.Pool({
  connectionString: requireEnv(
    'DATABASE_URL',
    isProduction()
      ? undefined
      : 'postgresql://researchium:researchium@127.0.0.1:5432/researchium'
  ),
  max: 10,
  idleTimeoutMillis: 30_000,
});

export async function pingDb() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}
