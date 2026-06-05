/**
 * Creates the `account` table required by better-auth for social/OAuth providers.
 * Run with: node --env-file=.env.local scripts/migrate-account-table.mjs
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const SQL = `
CREATE TABLE IF NOT EXISTS "account" (
  "id"                      TEXT        NOT NULL PRIMARY KEY,
  "accountId"               TEXT        NOT NULL,
  "providerId"              TEXT        NOT NULL,
  "userId"                  TEXT        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken"             TEXT,
  "refreshToken"            TEXT,
  "idToken"                 TEXT,
  "accessTokenExpiresAt"    TIMESTAMP,
  "refreshTokenExpiresAt"   TIMESTAMP,
  "scope"                   TEXT,
  "password"                TEXT,
  "createdAt"               TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "account_accountId_providerId_idx" ON "account"("accountId", "providerId");
`;

try {
  await pool.query(SQL);
  console.log('✓ Table "account" créée (ou déjà existante).');
} catch (err) {
  console.error("✗ Erreur lors de la migration :", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
