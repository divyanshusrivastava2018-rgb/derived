#!/usr/bin/env node
/**
 * Seed demo researchers and streams. Requires Postgres + .env DATABASE_URL.
 * Usage: node scripts/seed.js
 */
import { pool } from '../src/db/pool.js';
import bcrypt from 'bcrypt';

const DEMO_EMAIL = 'demo@gmail.com';
const DEMO_PASSWORD = 'demo12345';

const demos = [
  {
    researcher: {
      name: 'Dr. A. Mercer',
      orcid: '0000-0001-2345-6789',
      institution: 'MIT Photonics',
    },
    stream: {
      title: 'Entangled Photon Source: Double-Slit Configuration',
      topic: 'Quantum Physics',
      roomSlug: 'mit-photonics-live',
      status: 'live',
      isGated: false,
    },
  },
  {
    researcher: {
      name: 'Prof. Sun Wei',
      orcid: '0000-0002-3456-7890',
      institution: 'Peking University',
    },
    stream: {
      title: 'CRISPR Off-Target Analysis in Human Stem Cells',
      topic: 'Genomics',
      roomSlug: 'pku-genomics',
      status: 'live',
      isGated: true,
      gatePassword: 'peer-review-only',
    },
  },
];

async function seedDemoUser() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const { rows: rRows } = await pool.query(
    `INSERT INTO researchers (name, orcid, institution)
     VALUES ('Demo Researcher', '0000-0000-0000-0001', 'Researchium')
     ON CONFLICT (orcid) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  await pool.query(
    `INSERT INTO users (email, password_hash, name, researcher_id)
     VALUES ($1, $2, 'Demo Researcher', $3)
     ON CONFLICT (email) DO NOTHING`,
    [DEMO_EMAIL, hash, rRows[0].id]
  );
  console.log(`[seed] demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

async function seed() {
  await seedDemoUser();
  for (const demo of demos) {
    const { rows: rRows } = await pool.query(
      `INSERT INTO researchers (name, orcid, institution)
       VALUES ($1, $2, $3)
       ON CONFLICT (orcid) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [demo.researcher.name, demo.researcher.orcid, demo.researcher.institution]
    );
    const hostId = rRows[0].id;
    let gateHash = null;
    if (demo.stream.isGated) {
      gateHash = await bcrypt.hash(demo.stream.gatePassword, 12);
    }
    await pool.query(
      `INSERT INTO streams (host_id, title, topic, status, room_slug, is_gated, gate_password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (room_slug) DO NOTHING`,
      [
        hostId,
        demo.stream.title,
        demo.stream.topic,
        demo.stream.status,
        demo.stream.roomSlug,
        demo.stream.isGated,
        gateHash,
      ]
    );
    console.log(`[seed] ${demo.stream.roomSlug}`);
  }
  await pool.end();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed', err.message);
  process.exit(1);
});
