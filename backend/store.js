// store.js - user storage with automatic fallback.
//
//   DATABASE_URL set and reachable  -> PostgreSQL (used on Render / production)
//   otherwise                       -> backend/data/users.json (zero-setup local dev)
//
// Same async API either way: init, findByEmail, findById, createUser.

const fs = require('fs');
const path = require('path');

const IS_VERCEL = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const USERS_DIR = IS_VERCEL ? path.join('/tmp', 'ecokart-data') : path.join(__dirname, 'data');
const USERS_FILE = path.join(USERS_DIR, 'users.json');
const SEED_USERS_FILE = path.join(__dirname, 'data', 'users.json');

let mode = 'file'; // 'file' | 'pg'
let db = null;
let memUsers = null;

async function init() {
  const dbUrl = process.env.DATABASE_URL || process.env.internal_database_url || process.env.INTERNAL_DATABASE_URL;
  if (dbUrl) {
    if (!process.env.DATABASE_URL) process.env.DATABASE_URL = dbUrl;
    try {
      db = require('./db');
      await db.ensureSchema();
      mode = 'pg';
      console.log('[store] users: PostgreSQL');
      return;
    } catch (err) {
      const { describeDbError } = require('./db');
      console.error('[store] Postgres not usable: ' + describeDbError(err));
      console.error('[store] falling back to file/memory store');
    }
  } else {
    console.log('[store] users: file/memory store - set DATABASE_URL to use Postgres');
  }
  mode = 'file';
  ensureFile();
}

function ensureFile() {
  try {
    if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) {
      if (fs.existsSync(SEED_USERS_FILE)) {
        fs.copyFileSync(SEED_USERS_FILE, USERS_FILE);
      } else {
        fs.writeFileSync(USERS_FILE, '[]\n');
      }
    }
  } catch (e) {
    console.warn('[store] Note: could not ensure users file on disk:', e.message);
  }
}

function readUsers() {
  if (memUsers) return memUsers;

  if (fs.existsSync(USERS_FILE)) {
    try {
      memUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
      if (Array.isArray(memUsers)) return memUsers;
    } catch {}
  }

  if (fs.existsSync(SEED_USERS_FILE)) {
    try {
      memUsers = JSON.parse(fs.readFileSync(SEED_USERS_FILE, 'utf8') || '[]');
      if (Array.isArray(memUsers)) return memUsers;
    } catch {}
  }

  memUsers = [];
  return memUsers;
}

function writeUsers(list) {
  memUsers = list;
  try {
    if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2) + '\n');
  } catch (err) {
    console.warn('[store] Disk write skipped for users.json:', err.message);
  }
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

async function getAllUsers() {
  if (mode === 'pg') {
    const { rows } = await db.query(
      'SELECT id, email, created_at FROM users ORDER BY id DESC'
    );
    return rows;
  }
  return readUsers()
    .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }))
    .reverse();
}

module.exports = {
  init,
  findByEmail,
  findById,
  createUser,
  getAllUsers,
  get mode() {
    return mode;
  },
};
