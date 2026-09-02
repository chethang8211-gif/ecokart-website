// db.js - Postgres connection pool
// Requires DATABASE_URL in the environment (see .env.example).

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn(
    '[db] DATABASE_URL is not set. Auth routes (/api/signup, /api/login, /api/me) ' +
    'will fail until you configure it. See backend/.env.example.'
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Managed Postgres providers (Render, Neon, Supabase, Heroku) require SSL.
  // Set PGSSL=true for those; leave unset for a local Postgres.
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  // Fail fast instead of hanging when nothing is listening.
  connectionTimeoutMillis: 5000,
});

// Turn a pg / socket error into something a human can act on.
function describeDbError(err) {
  const target = (() => {
    try {
      const u = new URL(DATABASE_URL);
      return `${u.hostname}:${u.port || 5432}`;
    } catch {
      return 'the configured host';
    }
  })();

  switch (err && err.code) {
    case 'ECONNREFUSED':
      return `No PostgreSQL server is accepting connections at ${target}. ` +
             `Is Postgres installed and running? (DATABASE_URL in backend/.env)`;
    case 'ENOTFOUND':
      return `Cannot resolve the database host (${target}). Check DATABASE_URL.`;
    case 'ETIMEDOUT':
    case 'ECONNRESET':
      return `Timed out connecting to Postgres at ${target}. Check the host/port and any firewall.`;
    case '28P01':
    case '28000':
      return `Postgres rejected the username/password in DATABASE_URL.`;
    case '3D000':
      return `That database does not exist. Create it first, e.g.  createdb ecokart`;
    case '42501':
      return `The Postgres user lacks permission to create tables in this database.`;
    default:
      if (!DATABASE_URL) return 'DATABASE_URL is not set (see backend/.env.example).';
      return err && (err.message || err.code)
        ? `${err.code || 'error'}: ${err.message || '(no message)'}`
        : 'Unknown database error (no code/message from the driver).';
  }
}

pool.on('error', (err) => {
  console.error('[db] idle client error:', describeDbError(err));
});

// Apply schema.sql. Idempotent - safe to run on every boot.
async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  ensureSchema,
  describeDbError,
  pool,
};
