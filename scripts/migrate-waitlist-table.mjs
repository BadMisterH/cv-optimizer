/**
 * Creates the `waitlist_signups` table used by the /api/waitlist smoke-test route.
 * Run with: node --env-file=.env.local scripts/migrate-waitlist-table.mjs
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const SQL = `
CREATE TABLE IF NOT EXISTS "waitlist_signups" (
  "id"         SERIAL      PRIMARY KEY,
  "email"      TEXT        NOT NULL,
  "pack"       TEXT        NOT NULL,
  "user_id"    TEXT        REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE ("email", "pack")
);
`;

try {
  await pool.query(SQL);
  console.log('✓ Table "waitlist_signups" créée (ou déjà existante).');
} catch (err) {
  console.error("✗ Erreur lors de la migration :", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
