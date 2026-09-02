-- EcoKart auth schema
-- Run once against your database:
--   psql "$DATABASE_URL" -f schema.sql
-- or:  npm run migrate   (from the backend/ folder)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive lookups on email (signup/login normalise to lower-case,
-- this index just keeps that fast and enforced).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
