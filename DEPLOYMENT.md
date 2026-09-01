# Deployment Guide

Two supported options:

- **Option 1 · Netlify (easiest)** — static hosting with HTTPS + CDN, zero maintenance. See below.
- **Option 2 · Oracle Cloud VM** — your own Always-Free ARM box running Caddy. See [Part 2](#part-2--oracle-cloud-vm-always-free).

Both run on the same stack: **Supabase** (database + auth, managed & free) + the static app bundle. Total cost: **৳0 / $0 forever**.

---

## Option 1 · Netlify (recommended if you don't want to manage a server)

The app is a pure static SPA — Netlify is a perfect fit (free tier: 100 GB bandwidth/month).

### One-time setup

1. Push this folder to a GitHub/GitLab repo (`.env` is git-ignored — safe).
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → pick the repo.
   `netlify.toml` already sets the build command (`npm run build`), publish dir (`dist`), and Node version.
3. **Site configuration → Environment variables** — add both (they're baked into the bundle at build time):

   | Key | Value |
   | --- | ----- |
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |

4. Deploy. Every `git push` now redeploys automatically.

`public/_redirects` (already included) sends all paths to `index.html` so React Router deep links and page refreshes work.

### Tell Supabase about your Netlify domain (for auth emails)

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL** → your Netlify URL (e.g. `https://hisab.netlify.app`) — confirmation/recovery links land here.
- Add the URL to **Redirect URLs** too.

### Alternative: quick manual deploy (no Git)

```bash
npm run build
npx netlify-cli deploy --prod --dir=dist
```

(Drag-and-dropping `dist/` at app.netlify.com also works — your local `.env` values are already baked into the bundle.)

---

## Option 2 · Supabase (database + auth) — required for both paths

1. **Create project** — [supabase.com](https://supabase.com) → New project.
   Free tier: 500 MB database, 50,000 users — far beyond personal needs.
2. **Run the migration** — SQL Editor → paste
   [`supabase/migrations/001_schema.sql`](./supabase/migrations/001_schema.sql) → Run.
   Creates tables, row-level security, and the default-categories seed trigger.
3. **(Recommended) Skip email confirmation** — Authentication → Sign In / Providers → Email →
   turn **off** "Confirm email". For a personal app this makes sign-up instant.
   Also add your production domain under **URL Configuration → Redirect URLs** if you ever use
   magic links / password recovery.
4. **Copy credentials** — Project Settings → API → *Project URL* and *anon public* key.
   Put them in `.env` for local dev:

   ```bash
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   At deploy time the same values must be present when `npm run build` runs
   (Vite bakes env vars into the bundle at build time).

> **Free-tier note:** inactive Supabase projects pause after ~7 days. Using the app
> regularly prevents this; if it ever shows "paused", just click restore in the dashboard.

---

## Part 2 · Oracle Cloud VM (Always Free)

### 1. Create the instance

1. [cloud.oracle.com](https://cloud.oracle.com) → Compute → Create Instance.
2. Name: `hisab`. Image: **Canonical Ubuntu 24.04**. Shape: change to **VM.Standard.A1.Flex**
   (Ampere ARM) with **1 OCPU / 4 GB RAM** — comfortably inside the Always-Free allowance
   (2 OCPUs / 12 GB total as of 2026). 50 GB boot volume is fine.
3. **SSH key:** generate or paste a public key — you'll need the private key to deploy.
4. Create, wait for it to be RUNNING, note the **Public IP**.

### 2. Open ports 80/443 — two places!

Oracle blocks traffic in **both** the VCN security list *and* the OS firewall:

**a) VCN Security List** (Networking → Virtual Cloud Networks → your VCN → Security Lists):

| Source | Port | Protocol |
| ------ | ---- | -------- |
| 0.0.0.0/0 | 80 | TCP |
| 0.0.0.0/0 | 443 | TCP |

**b) Instance iptables** (SSH in first — see below):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 3. First SSH login

```bash
chmod 400 ~/.ssh/id_ed25519        # your private key
ssh -i ~/.ssh/id_ed25519 ubuntu@<PUBLIC-IP>
```

If you chose a non-default SSH key name/path, adjust everywhere below.

### 4. Get a free domain (DuckDNS)

1. Sign in at [duckdns.org](https://www.duckdns.org) with any provider.
2. Create a subdomain, e.g. `fathe-hisab` → `fathe-hisab.duckdns.org`.
3. Put your **VM public IP** in the domain's "ip" field (or use the auto-update
   curl command they show — paste it into the VM's crontab):

   ```bash
   */5 * * * * curl -s "https://www.duckdns.org/update?domains=fathe-hisab&token=YOUR_TOKEN&ip=" > /dev/null
   ```

### 5. Install Caddy (automatic HTTPS)

On the VM:

```bash
sudo apt update && sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Prepare the web root
sudo mkdir -p /var/www/expense
sudo chown -R ubuntu:ubuntu /var/www/expense
```

Copy this repo's `Caddyfile` to the VM and put your real domain in it:

```bash
# from your laptop, in the project folder:
scp -i ~/.ssh/id_ed25519 Caddyfile ubuntu@<PUBLIC-IP>:/tmp/Caddyfile
# then on the VM:
sudo mv /tmp/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/<your-subdomain>.duckdns.org/fathe-hisab.duckdns.org/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy now serves `https://fathe-hisab.duckdns.org` with a valid certificate, forever renewed.

---

## Part 3 · Deploy the app

From your laptop, in the project folder:

```bash
# make sure .env holds the Supabase URL + anon key from Part 1
DEPLOY_HOST=<PUBLIC-IP> ./deploy.sh
```

The script builds (`npm run build`, which bakes the env vars into the static bundle) and
rsyncs `dist/` to the VM. Caddy picks up the new files **instantly — no restart needed**.

Later deploys are the same one command.

### One-time: enable the deploy script

```bash
chmod +x deploy.sh
```

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Site unreachable (timeout) | Ports not open — check **both** VCN security list and `iptables` (Part 2.2). |
| Caddy certificate error | DNS not pointing at the VM yet — check DuckDNS, wait a few minutes. |
| "Missing VITE_SUPABASE_URL" or app can't reach Supabase | Rebuild with `.env` present — env vars are baked in at build time. |
| Blank page after deploy | Confirm `/var/www/expense/index.html` exists on the VM (`ls`). |
| Supabase says project paused | Free-tier idling — click *Restore* in the Supabase dashboard. |

## Updating later

```bash
git pull            # or edit files
DEPLOY_HOST=<PUBLIC-IP> ./deploy.sh
```
