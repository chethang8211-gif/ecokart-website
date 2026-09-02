// store.js - user storage with automatic fallback.
//
//   DATABASE_URL set and reachable  -> PostgreSQL (used on Render / production)
//   otherwise                       -> backend/data/users.json (zero-setup local dev)
//
// Same async API either way: init, findByEmail, findById, createUser.

const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

let mode = 'file'; // 'file' | 'pg'
let db = null;

async function init() {
  if (process.env.DATABASE_URL) {
    try {
      db = require('./db');
      await db.ensureSchema();
      mode = 'pg';
      console.log('[store] users: PostgreSQL');
      return;
    } catch (err) {
      const { describeDbError } = require('./db');
      console.error('[store] Postgres not usable: ' + describeDbError(err));
      console.error('[store] falling back to file store (backend/data/users.json)');
    }
  } else {
    console.log('[store] users: file store (backend/data/users.json) - set DATABASE_URL to use Postgres');
  }
  mode = 'file';
  ensureFile();
}

function ensureFile() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]\n');
}

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function writeUsers(list) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2) + '\n');
}

async function findByEmail(email) {
  if (mode === 'pg') {
    const { rows } = await db.query(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  }
  return readUsers().find((u) => u.email === email) || null;
}

async function findById(id) {
  if (mode === 'pg') {
    const { rows } = await db.query(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }
  return readUsers().find((u) => String(u.id) === String(id)) || null;
}

// Throws an error with code '23505' if the email already exists (matches pg).
async function createUser(email, passwordHash) {
  if (mode === 'pg') {
    const { rows } = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );
    return rows[0];
  }
  const list = readUsers();
  if (list.some((u) => u.email === email)) {
    const err = new Error('duplicate email');
    err.code = '23505';
    throw err;
  }
  const user = {
    id: list.length ? Math.max(...list.map((u) => Number(u.id) || 0)) + 1 : 1,
    email,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
  };
  list.push(user);
  writeUsers(list);
  return { id: user.id, email: user.email, created_at: user.created_at };
}

module.exports = {
  init,
  findByEmail,
  findById,
  createUser,
  get mode() {
    return mode;
  },
};
