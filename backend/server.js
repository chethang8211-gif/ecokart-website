// server.js - EcoKart backend
// - Serves the static frontend (../frontend)
// - Marketplace API: products, wallet, buy/earn/redeem (JSON-file storage)
// - Auth API: /api/signup, /api/login, /api/me (Postgres + bcrypt + JWT)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');

// Dev convenience: without a secret, generate an ephemeral one so local runs
// work with zero config. Production (Render) always sets JWT_SECRET explicitly.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
  console.warn('[auth] JWT_SECRET not set - using a random dev secret (tokens reset on restart)');
}

const authRouter = require('./routes/auth');
const store = require('./store');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3002;

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// On a fresh host (e.g. Render) these folders may not exist yet.
for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Storage for uploads -> backend/uploads
const upload = multer({ dest: UPLOADS_DIR });

// ---------------- Middleware ----------------
// CORS_ORIGIN: comma-separated allowlist, or "*" (default) for any origin.
const corsOrigin = (process.env.CORS_ORIGIN || '*').trim();
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
}));
app.use(bodyParser.json());
// Serve static frontend files
app.use(express.static(FRONTEND_DIR));
// Serve uploaded images
app.use('/uploads', express.static(UPLOADS_DIR));

// ---------------- Helpers ----------------
function readJSON(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) {
    if (file === 'products.json' || file === 'feedback.json') return [];
    if (file === 'wallet.json') return { coins: 0, totalEarned: 0, totalRedeemed: 0, transactions: [] };
    return {};
  }
  const raw = fs.readFileSync(p, 'utf8') || 'null';
  try { return JSON.parse(raw); } catch { return {}; }
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

// ---------------- Public Endpoints ----------------
app.use('/api', authRouter);            // /api/signup, /api/login, /api/demo-login, /api/me
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Browse products without mandatory login
app.get('/api/products', (_req, res) => {
  res.json(readJSON('products.json'));
});

// Feedback: Read community reviews
app.get('/api/feedback', (_req, res) => {
  const list = readJSON('feedback.json');
  const validList = Array.isArray(list) ? list : [];
  const total = validList.length;
  const avg = total > 0 ? (validList.reduce((acc, f) => acc + (Number(f.rating) || 5), 0) / total).toFixed(1) : 5.0;
  res.json({
    feedbacks: [...validList].reverse(), // newest first
    averageRating: parseFloat(avg),
    totalCount: total
  });
});

// Feedback: Submit new feedback
app.post('/api/feedback', (req, res) => {
  const { name, email, rating, category, message } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Feedback message is required' });
  }

  const list = readJSON('feedback.json');
  const validList = Array.isArray(list) ? list : [];
  const id = validList.length ? Math.max(...validList.map(f => f.id || 0)) + 1 : 1;

  const newFeedback = {
    id,
    name: (name && name.trim()) || 'Eco-Visitor',
    email: (email && email.trim()) || '',
    rating: Math.min(5, Math.max(1, parseInt(rating, 10) || 5)),
    category: (category && category.trim()) || 'Overall Experience',
    message: message.trim(),
    created_at: new Date().toISOString()
  };

  validList.push(newFeedback);
  writeJSON('feedback.json', validList);

  res.status(201).json({ success: true, feedback: newFeedback });
});

// ---------------- Everything below under /api needs a valid token ----------------
app.use('/api', requireAuth);

// ---------------- Products (Protected Mutations) ----------------

// Create product with image upload (multipart/form-data)
app.post('/api/products', upload.single('imageFile'), (req, res) => {
  const { name, price, ecoImpact } = req.body || {};
  if (!name || price == null || !ecoImpact) {
    return res.status(400).json({ success: false, message: 'name, price, ecoImpact are required' });
  }
  let imageUrl = '';
  if (req.file) {
    imageUrl = '/uploads/' + req.file.filename; // public path
  }

  const products = readJSON('products.json');
  const id = products.length ? Math.max(...products.map(p => p.id || 0)) + 1 : 1;
  products.push({ id, name, price: Number(price), ecoImpact, imageUrl });
  writeJSON('products.json', products);
  res.json({ success: true, product: { id } });
});

// ---------------- Wallet ----------------
app.get('/api/wallet', (req, res) => {
  res.json(readJSON('wallet.json'));
});

// Buy with MONEY -> reward 1 coin per ₹10 spent
app.post('/api/buy', (req, res) => {
  const { productId, price } = req.body || {};
  const p = Number(price);
  if (isNaN(p) || p < 0) {
    return res.status(400).json({ success:false, message:'Invalid price' });
  }
  const earned = Math.floor(p / 10);

  const w = readJSON('wallet.json');
  w.coins = (w.coins || 0) + earned;
  w.totalEarned = (w.totalEarned || 0) + earned;

  w.transactions = w.transactions || [];
  w.transactions.unshift({
    type: 'earn',
    productId: productId || null,
    amount: earned,
    at: new Date().toISOString(),
    note: `Purchase reward (+${earned} EcoCoins for ₹${p})`
  });

  writeJSON('wallet.json', w);
  res.json({ success:true, wallet:w, earned });
});

// Manual earn (optional)
app.post('/api/earn', (req, res) => {
  const { coins, note } = req.body || {};
  if (coins == null) return res.status(400).json({ success:false, message:'coins is required' });
  const w = readJSON('wallet.json');
  w.coins += Number(coins);
  w.totalEarned = (w.totalEarned||0) + Number(coins);
  w.transactions = w.transactions || [];
  w.transactions.unshift({ type:'earn', amount:Number(coins), at:new Date().toISOString(), note: note||'Earned EcoCoins' });
  writeJSON('wallet.json', w);
  res.json({ success:true, wallet:w });
});

// Redeem plant (spend EcoCoins)
app.post('/api/redeem', (req, res) => {
  const { plantName, plant_price } = req.body || {};
  if (plant_price == null) return res.status(400).json({ success:false, message:'plant_price is required' });

  const w = readJSON('wallet.json');
  if ((w.coins || 0) < Number(plant_price)) {
    return res.status(400).json({ success:false, message:'Not enough EcoCoins to redeem' });
  }
  w.coins -= Number(plant_price);
  w.totalRedeemed = (w.totalRedeemed||0) + Number(plant_price);
  w.transactions = w.transactions || [];
  w.transactions.unshift({
    type:'redeem',
    amount:-Number(plant_price),
    at:new Date().toISOString(),
    note: plantName ? `Redeemed ${plantName}` : 'Redeemed plant'
  });

  writeJSON('wallet.json', w);
  res.json({ success:true, wallet:w });
});

// ---------------- Misc ----------------
app.get('/', (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// ---------------- Boot ----------------
async function start() {
  // Picks Postgres if DATABASE_URL works, else a local JSON file. Never throws.
  await store.init();
  app.listen(PORT, () => console.log(`EcoKart server running on port ${PORT}`));
}

start();
