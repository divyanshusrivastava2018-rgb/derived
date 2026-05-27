import { pool } from '../db/pool.js';
import { assertUuid } from '../../../shared/validate.js';
import { sanitizeShortText } from '../../../shared/validate.js';

export async function listResearchers({ limit = 20, offset = 0 }) {
  const { rows } = await pool.query(
    `SELECT id, orcid, name, institution, created_at
     FROM researchers
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function getResearcherById(id) {
  assertUuid(id, 'researcher id');
  const { rows } = await pool.query(
    `SELECT id, orcid, name, institution, created_at FROM researchers WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createResearcher({ name, orcid, institution }) {
  const { rows } = await pool.query(
    `INSERT INTO researchers (name, orcid, institution)
     VALUES ($1, $2, $3)
     RETURNING id, orcid, name, institution, created_at`,
    [
      sanitizeShortText(name, 120),
      orcid ? sanitizeShortText(orcid, 32) : null,
      institution ? sanitizeShortText(institution, 200) : null,
    ]
  );
  return rows[0];
}
