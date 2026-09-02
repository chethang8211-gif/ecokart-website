// routes/auth.js - email + password auth
//   POST /api/signup  { email, password }        -> 201 { id, email }
//   POST /api/login   { email, password }        -> 200 { token, email }
//   GET  /api/me      Authorization: Bearer <t>  -> 200 { id, email, created_at }
//
// Storage (Postgres or JSON file) is handled by ../store.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const store = require('../store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuv0123456789012345678901234567890a';

function validateCredentials(email, password) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) return 'A valid email is required';
  if (typeof password !== 'string' || password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

// ---------------- Signup ----------------
router.post('/signup', async (req, res) => {
  const { email, password } = req.body || {};
  const problem = validateCredentials(email, password);
  if (problem) return res.status(400).json({ error: problem });

  const normEmail = email.trim().toLowerCase();

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await store.createUser(normEmail, hash);
    return res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('[signup]', err.message);
    return res.status(500).json({ error: 'Could not create account' });
  }
});

// ---------------- Login ----------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET is not set' });
  }

  const normEmail = email.trim().toLowerCase();

  try {
    const user = await store.findByEmail(normEmail);
    // Compare even when the user is missing to keep response timing uniform.
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    return res.json({ token, email: user.email });
  } catch (err) {
    console.error('[login]', err.message);
    return res.status(500).json({ error: 'Could not log in' });
  }
});

// ---------------- Protected: current user ----------------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await store.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ id: user.id, email: user.email, created_at: user.created_at });
  } catch (err) {
    console.error('[me]', err.message);
    return res.status(500).json({ error: 'Could not load profile' });
  }
});

module.exports = router;
