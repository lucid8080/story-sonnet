## Story Sonnet – Neon, Cloudflare R2, Clerk & Stripe

### 1. Neon (Postgres)

- Create a project at [https://neon.tech](https://neon.tech) and copy the connection string → `DATABASE_URL` (server-side only).
- In the Neon SQL editor (or `psql`), run the schema in `neon/migrations/001_neon_schema.sql`.
- **Profiles** use **Clerk user IDs** (`profiles.id` is `text`, e.g. `user_xxx`).

### 2. Clerk (auth)

- Create an application in the [Clerk dashboard](https://dashboard.clerk.com).
- Add **Email** and any OAuth providers you need (Google, Apple).
- Copy **Publishable key** → `VITE_CLERK_PUBLISHABLE_KEY` (Vite / browser).
- Copy **Secret key** → `CLERK_SECRET_KEY` (API server only).
- In Clerk, set **Authorized redirect URLs** to include:
  - `http://localhost:5173/sso-callback` (dev)
  - `https://your-domain.com/sso-callback` (production)

### 3. Cloudflare R2 (uploads)

- Create an R2 bucket and optional **public custom domain** (or public bucket URL) for read access.
- Create **S3 API tokens** (Access Key ID + Secret) with permission to write to that bucket.
- Set:

  - `R2_ACCOUNT_ID` – Cloudflare account id (R2 overview).
  - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` – API token credentials.
  - `R2_BUCKET` – bucket name.
  - `R2_PUBLIC_BASE_URL` – public base URL for objects (no trailing slash), e.g. `https://assets.example.com`.

Static story assets (library MP3/covers) can still use `VITE_ASSETS_BASE_URL` as documented in `story-app/R2_SETUP.md`.

#### Cloudflare Wrangler CLI (optional)

Wrangler is installed **locally** in `story-app` (devDependency). Prefer `npm run wrangler` over global `npm install -g wrangler`.

**Note:** Wrangler 4 depends on `undici@7.24.4`, which may not exist on npm yet. This repo uses an **`overrides`** entry in `story-app/package.json` to pin `undici` to `7.22.0` so installs succeed. If Cloudflare publishes `undici@7.24.4` later, you can remove the override.

From `story-app/`:

- `npm run wrangler -- --version` — check the CLI
- `npm run wrangler -- login` — authenticate once (browser)
- `npm run wrangler -- r2 bucket list` — list R2 buckets (after login)

The `cf` script is an alias: `npm run cf -- r2 bucket list`.

### 4. Admin role

- After you sign in once, a row is created in `profiles` (via `GET /api/me`).
- In Neon, set `profiles.role = 'admin'` for your Clerk user id to unlock `/admin`.

### 5. Stripe

- Stripe **Secret key** → `STRIPE_SECRET_KEY`.
- Subscription **Price ID** → `STRIPE_PRICE_ID` (backend) and `VITE_STRIPE_PRICE_ID` if the frontend needs it for display.
- **Webhook** signing secret → `STRIPE_WEBHOOK_SECRET`.
- Webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Customer metadata uses `clerk_user_id` in Stripe where applicable.

### 6. Environment variables

- **Frontend** (`story-app/.env.local`): `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SITE_URL`, `VITE_STRIPE_PRICE_ID`, `VITE_ASSETS_BASE_URL` as needed.
- **Backend** (`backend/.env` or host env): `DATABASE_URL`, `CLERK_SECRET_KEY`, R2 variables, `STRIPE_*`, `SITE_URL` (matches your deployed site URL for Stripe redirects).

See repo root `.env.example` for a full list.

### 7. API routes (backend)

Map HTTP routes to the handlers under `backend/` (names are examples; align with your host):

| Route | Handler |
|--------|---------|
| `GET /api/me` | `backend/me.js` |
| `GET /api/stories` | `backend/stories-api.js` (optional `?slug=`) |
| `PATCH /api/admin/stories` | `backend/admin-stories.js` |
| `GET /api/admin/stats` | `backend/admin-stats.js` |
| `GET /api/admin/uploads` | `backend/admin-uploads.js` |
| `POST /api/upload` | `backend/upload.js` |
| `POST /api/create-checkout-session` | `backend/stripe/create-checkout-session.js` |
| `POST /api/create-customer-portal` | `backend/stripe/create-customer-portal.js` |
| `POST /api/stripe-webhook` | `backend/stripe/stripe-webhook.js` (raw body) |

**Local dev:** from `backend/`, run `npm install` and `npm run dev` (starts Express on port **8787**). The Vite app proxies `/api` to `http://localhost:8787` (see `story-app/vite.config.js`).

### 8. Running locally

```bash
cd backend && npm install && npm run dev
```

In another terminal:

```bash
cd story-app && npm install && npm run dev
```

Open `http://localhost:5173`. With `VITE_CLERK_PUBLISHABLE_KEY` and the API running, auth and Neon-backed stories work; without Clerk, the app falls back to static seed data (same idea as the old “no Supabase” mode).

### 9. What was removed

- **Supabase** (`@supabase/supabase-js`) is no longer used. Database access is server-side via Neon; auth is Clerk; file uploads go to R2.
