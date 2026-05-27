import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import * as devAuth from '../dev-auth.js';
import {
  assertEmail,
  assertPassword,
  sanitizeShortText,
} from '../../../shared/validate.js';

async function queryUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.password_hash, u.researcher_id,
            r.name AS researcher_name, r.institution
     FROM users u
     LEFT JOIN researchers r ON r.id = u.researcher_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [email]
  );
  return rows[0] || null;
}

async function queryUserById(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.password_hash, u.researcher_id,
            r.name AS researcher_name, r.institution
     FROM users u
     LEFT JOIN researchers r ON r.id = u.researcher_id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function findByEmail(email) {
  const normalized = assertEmail(email);
  if (devAuth.devAuthEnabled() && !(await devAuth.isDatabaseAvailable())) {
    return devAuth.findDevUserByEmail(normalized);
  }
  try {
    return await queryUserByEmail(normalized);
  } catch (e) {
    if (devAuth.devAuthEnabled() && devAuth.isDbConnectionError(e)) {
      devAuth.markDatabaseUnavailable();
      return devAuth.findDevUserByEmail(normalized);
    }
    throw e;
  }
}

export async function findById(id) {
  if (devAuth.devAuthEnabled() && devAuth.findDevUserById(id)) {
    if (!(await devAuth.isDatabaseAvailable())) {
      return devAuth.findDevUserById(id);
    }
  }
  try {
    const row = await queryUserById(id);
    if (row) return row;
    if (devAuth.devAuthEnabled()) {
      return devAuth.findDevUserById(id);
    }
    return null;
  } catch (e) {
    if (devAuth.devAuthEnabled() && devAuth.isDbConnectionError(e)) {
      devAuth.markDatabaseUnavailable();
      return devAuth.findDevUserById(id);
    }
    throw e;
  }
}

export async function register({ email, password, name, institution }) {
  const cleanEmail = assertEmail(email);
  assertPassword(password);
  const cleanName = sanitizeShortText(name, 120);
  if (!cleanName) {
    const err = new Error('name_required');
    err.status = 400;
    throw err;
  }

  if (devAuth.devAuthEnabled() && !(await devAuth.isDatabaseAvailable())) {
    return devAuth.registerDevUser({
      email: cleanEmail,
      password,
      name: cleanName,
      institution,
    });
  }

  const hash = await bcrypt.hash(String(password), 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: rRows } = await client.query(
      `INSERT INTO researchers (name, institution)
       VALUES ($1, $2)
       RETURNING id`,
      [cleanName, institution ? sanitizeShortText(institution, 200) : null]
    );
    const researcherId = rRows[0].id;
    const { rows: uRows } = await client.query(
      `INSERT INTO users (email, password_hash, name, researcher_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, researcher_id`,
      [cleanEmail, hash, cleanName, researcherId]
    );
    await client.query('COMMIT');
    return uRows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') {
      const err = new Error('email_exists');
      err.status = 409;
      throw err;
    }
    if (devAuth.devAuthEnabled() && devAuth.isDbConnectionError(e)) {
      devAuth.markDatabaseUnavailable();
      return devAuth.registerDevUser({
        email: cleanEmail,
        password,
        name: cleanName,
        institution,
      });
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function verifyLogin(email, password) {
  if (!email || !password) {
    const err = new Error('email_password_required');
    err.status = 400;
    throw err;
  }
  let normalized;
  try {
    normalized = assertEmail(email);
  } catch {
    const err = new Error('invalid_credentials');
    err.status = 401;
    throw err;
  }
  const user = await findByEmail(normalized);
  if (!user) {
    const err = new Error('invalid_credentials');
    err.status = 401;
    throw err;
  }
  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) {
    const err = new Error('invalid_credentials');
    err.status = 401;
    throw err;
  }
  return user;
}

export async function updateProfile(userId, { name, institution }) {
  const cleanName = name !== undefined ? sanitizeShortText(name, 120) : undefined;
  if (cleanName !== undefined && !cleanName) {
    const err = new Error('name_required');
    err.status = 400;
    throw err;
  }
  const cleanInst =
    institution !== undefined ? sanitizeShortText(institution, 200) || null : undefined;

  if (devAuth.devAuthEnabled()) {
    const dev = devAuth.findDevUserById(userId);
    if (dev && !(await devAuth.isDatabaseAvailable())) {
      if (cleanName) dev.name = dev.researcher_name = cleanName;
      if (cleanInst !== undefined) dev.institution = cleanInst;
      return dev;
    }
  }

  const user = await findById(userId);
  if (!user) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (cleanName !== undefined) {
      await client.query(`UPDATE users SET name = $1 WHERE id = $2`, [cleanName, userId]);
    }
    if (cleanInst !== undefined && user.researcher_id) {
      await client.query(`UPDATE researchers SET institution = $1 WHERE id = $2`, [
        cleanInst,
        user.researcher_id,
      ]);
      if (cleanName !== undefined) {
        await client.query(`UPDATE researchers SET name = $1 WHERE id = $2`, [
          cleanName,
          user.researcher_id,
        ]);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return findById(userId);
}

export async function changePassword(userId, currentPassword, newPassword) {
  assertPassword(newPassword);
  const user = await findById(userId);
  if (!user) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const ok = await bcrypt.compare(String(currentPassword), user.password_hash);
  if (!ok) {
    const err = new Error('invalid_credentials');
    err.status = 401;
    throw err;
  }
  const hash = await bcrypt.hash(String(newPassword), 12);

  if (devAuth.devAuthEnabled() && devAuth.findDevUserById(userId)) {
    if (!(await devAuth.isDatabaseAvailable())) {
      user.password_hash = hash;
      return;
    }
  }

  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, userId]);
}

export function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    researcherId: row.researcher_id,
    institution: row.institution || null,
  };
}
