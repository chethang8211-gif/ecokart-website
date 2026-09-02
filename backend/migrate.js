// migrate.js - apply schema.sql to the database in DATABASE_URL
// Usage:  npm run migrate   (from backend/)
// The server also creates the table automatically on boot when DATABASE_URL is set.

require('dotenv').config();

const { ensureSchema, describeDbError, pool } = require('./db');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  await ensureSchema();
  console.log('Migration applied: users table is ready.');
  await pool.end();
}

main().catch((err) => {
  console.error('\nMigration failed: ' + describeDbError(err));
  process.exit(1);
});
