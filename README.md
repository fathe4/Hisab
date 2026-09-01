# Hisab · Income & Expense Tracker

A personal income & expense tracker. Simple, clean, and free to run.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS (pure static SPA)
- **Backend:** Supabase (Postgres + email/password auth + row-level security — every user sees only their own data)
- **Charts:** Recharts (monthly income vs expense, category breakdown)
- **Budgets:** monthly spending limits per expense category
- **Currency:** BDT (৳)
- **Hosting:** static files served by Caddy on an Oracle Cloud Always Free ARM VM with automatic HTTPS — see [DEPLOYMENT.md](./DEPLOYMENT.md)

## Quick start

### 1. Create the Supabase project (free, ~2 minutes)

1. Go to [supabase.com](https://supabase.com) → **New project** (any name, e.g. "hisab").
2. When it's ready, open **SQL Editor** → paste the contents of
   [`supabase/migrations/001_schema.sql`](./supabase/migrations/001_schema.sql) → **Run**.
   This creates the tables, row-level security, and auto-seeds default categories for every new user.
3. Optional (recommended for a personal app): **Authentication → Providers → Email** →
   disable *"Confirm email"* so sign-up logs you in instantly.
4. **Project Settings → API** → copy the **Project URL** and the **anon public** key.

### 2. Run locally

```bash
cp .env.example .env   # paste your URL + anon key
npm install
npm run dev
```

Open http://localhost:5173, create an account, and start tracking.

> The anon key is safe to ship in the frontend — the database is protected by
> row-level security, not by hiding the key.

### 3. Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Oracle Cloud setup (VM, firewall,
DuckDNS domain, Caddy HTTPS) and one-command deploys with `./deploy.sh`.

## Features

- Email/password login, private per-user data (RLS)
- Income & expense categories with emoji + color, seeded with sensible defaults
- Add/edit/delete transactions with notes and backdated entries
- Month-by-month navigation, search, and filters (type, category)
- Dashboard: monthly totals, 6-month trend chart, category donut, budget progress
- Mobile-first responsive UI (bottom nav + quick-add button)

## Scripts

| Command           | What it does              |
| ----------------- | ------------------------- |
| `npm run dev`     | Start dev server          |
| `npm run build`   | Type-check + production build into `dist/` |
| `npm run preview` | Preview the production build |
