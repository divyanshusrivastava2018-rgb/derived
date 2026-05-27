import pg from 'pg';
import { integrationConfig, usePostgres } from '../config.js';

const { Pool } = pg;
let pool = null;

export function getPool() {
  if (!usePostgres()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: integrationConfig.databaseUrl,
      max: Number(process.env.PG_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('[researchium-chat] pg pool error', err.message);
    });
  }
  return pool;
}

export async function pingDb() {
  const p = getPool();
  if (!p) return false;
  const r = await p.query('SELECT 1 AS ok');
  return r.rows[0]?.ok === 1;
}
