# EcoKart

Turning waste into value: buy recycled products → earn EcoCoins → redeem plants.
Now with email + password accounts (Postgres, bcrypt, JWT).

```
ecokart website/
├── backend/                 Express API + static file server
│   ├── server.js            App entry (port 3002)
│   ├── db.js                Postgres pool
│   ├── migrate.js           Applies schema.sql  (npm run migrate)
│   ├── schema.sql           users table
│   ├── routes/auth.js       /api/signup, /api/login, /api/me
│   ├── middleware/auth.js   Bearer-JWT verification
│   ├── data/                JSON "database": products.json (seed), wallet.json (runtime)
│   ├── uploads/             User-uploaded product images (runtime)
│   └── .env.example         Copy to .env and fill in
├── frontend/                Static HTML/CSS/JS (served by the backend)
│   ├── index.html buy.html sell.html wallet.html plant.html
│   ├── login.html signup.html dashboard.html   (auth UI)
│   ├── script.js style.css
└── .gitignore
```

## Prerequisites

- Node.js 18+ (uses `node --watch`)
- Postgres is **optional** — see "Storage" below

## Run (zero config)

```bash
cd backend
npm install
npm start          # or: npm run dev   (auto-restarts)
```

Open http://localhost:3002 — the backend serves the frontend from `../frontend`.
On Windows you can also just double-click `start.bat` in the project root.

No `.env` is needed. Out of the box:
- user accounts are saved to `backend/data/users.json`
- the JWT secret is randomly generated each start (log in still works; tokens
  just don't survive a restart)

## Storage

| | Trigger | Users stored in |
| --- | --- | --- |
| **File store** (default) | `DATABASE_URL` not set / not reachable | `backend/data/users.json` |
| **Postgres** | `DATABASE_URL` set and reachable | `users` table (auto-created on boot) |

To use Postgres locally, copy `backend/.env.example` to `backend/.env`, uncomment
`DATABASE_URL` and set real credentials (and `PGSSL=true` for managed Postgres).
Optional env: `JWT_SECRET` (fixed secret so tokens persist), `JWT_EXPIRES_IN`
(default `7d`), `PORT`, `CORS_ORIGIN`. Run `npm run migrate` to create the table
ahead of time, or just start the server.

## Auth API

| Method | Route          | Body / Header                          | Response                          |
| ------ | -------------- | ------------------------------------- | -------------------------------- |
| POST   | `/api/signup`  | `{ "email", "password" }` (min 6)    | `201 { id, email }`             |
| POST   | `/api/login`   | `{ "email", "password" }`            | `200 { token, email }`         |
| GET    | `/api/me`      | `Authorization: Bearer <token>`      | `200 { id, email, created_at }` |

Quick check:

```bash
curl -X POST http://localhost:3002/api/signup -H "Content-Type: application/json" -d "{\"email\":\"me@example.com\",\"password\":\"secret123\"}"
curl -X POST http://localhost:3002/api/login  -H "Content-Type: application/json" -d "{\"email\":\"me@example.com\",\"password\":\"secret123\"}"
curl http://localhost:3002/api/me -H "Authorization: Bearer <token-from-login>"
```

Or use the UI: `/signup.html` → `/login.html` → `/dashboard.html` (protected; redirects to login without a valid token).

## Marketplace API (unchanged, JSON-file backed)

`GET /api/products` · `POST /api/products` (multipart, image field `imageFile`) ·
`GET /api/wallet` · `POST /api/buy` · `POST /api/earn` · `POST /api/redeem` · `GET /api/health`

## Deployment — backend on Render, frontend on Netlify

The frontend talks to the backend with **relative URLs** (`/api/*`, `/uploads/*`).
Netlify proxies those paths to Render (`netlify.toml`), so no frontend code changes
are needed for the split deploy.

### 1. Backend → Render

`render.yaml` is a Blueprint that provisions the web service **and** a free Postgres DB.

1. Push this repo to GitHub.
2. Render dashboard → **New → Blueprint** → select the repo → **Apply**.
3. Render creates `ecokart-backend` + `ecokart-db`, wires `DATABASE_URL`, and
   generates `JWT_SECRET`. Because `DATABASE_URL` is set, the server uses Postgres
   and creates the `users` table on boot.
4. Copy the service URL: `https://<name>.onrender.com`. Check `…/api/health`.

Env vars (set by the blueprint; override in the dashboard if needed):
`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PGSSL=true`,
`CORS_ORIGIN` (optional — your Netlify origin).

> Free tier caveats: the service sleeps after ~15 min idle (first request is slow),
> and the filesystem is ephemeral — **uploaded product images don't survive a
> redeploy**. Add a paid Disk or move uploads to object storage for persistence.

### 2. Frontend → Netlify

1. Edit `netlify.toml` — replace **both** `https://ecokart-backend.onrender.com`
   targets with your real Render URL.
2. Netlify → **Add new site → Import an existing project** → select the repo.
   Build settings come from `netlify.toml` (publish dir `frontend/`, no build step).
3. Deploy. Visit the Netlify URL — signup/login/marketplace all work through the proxy.
4. (Optional) In Render, set `CORS_ORIGIN` to your Netlify origin.

### Deploy order

Render first (you need its URL for `netlify.toml`), then Netlify. On later changes,
pushing to the default branch auto-deploys both.

## Troubleshooting

**`[store] Postgres not usable: ...` on startup**
`DATABASE_URL` is set (usually in `backend/.env`) but that Postgres isn't
reachable / credentials are wrong. The server automatically falls back to the
file store and keeps running, so this is only a problem if you *want* Postgres.
Fixes:

- Just want it to run? Delete `backend/.env` (or comment out `DATABASE_URL`).
- Want Postgres locally? Set real credentials in `DATABASE_URL` and make sure the
  database exists (`createdb ecokart`).
- No local Postgres? Use a free one at [neon.tech](https://neon.tech) / Supabase,
  put its string in `DATABASE_URL`, set `PGSSL=true`.

The message tells you which: `rejected the username/password`, `that database
does not exist`, `No PostgreSQL server is accepting connections`, etc.

## Notes

- `bcryptjs` is used instead of the native `bcrypt` so `npm install` needs no build toolchain (identical hashes/API).
- `backend/data/wallet.json` and `backend/uploads/` are runtime state and are git-ignored; `products.json` is checked in as seed data.
- Serving the frontend elsewhere without the Netlify proxy? Set `API_URL` in `login.html`, `signup.html`, `dashboard.html` to the backend origin, and set `CORS_ORIGIN` on the backend.
