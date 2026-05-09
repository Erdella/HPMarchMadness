# HP March Madness — Production deploy

Target: **Proxmox LXC + Docker Compose + Cloudflare Tunnel**, with the React client on **Cloudflare Pages**.

End state when this is done:

```
Browser → hpmarchmadness.org           ─→ Cloudflare Pages (React build)
       → api.hpmarchmadness.org        ─→ Cloudflare Tunnel
                                        ─→ LXC on Proxmox
                                            ├── cloudflared
                                            ├── server (Node API)
                                            ├── postgres
                                            └── backup (daily pg_dump)
```

This guide assumes:

- A Proxmox host you can SSH into.
- A Cloudflare account that controls `hpmarchmadness.org` (or whichever domain you'll use).
- A Resend account (free tier, https://resend.com) for sending magic-link emails.
- Your code is pushed to a GitHub repo.

Total time to first working deploy: **30–60 minutes**, mostly waiting on DNS.

---

## 1. Create the LXC

On the Proxmox web UI:

1. **Create CT** → pick a fresh CT ID and hostname (e.g. `hpmm`).
2. **Template**: `debian-12-standard` or `ubuntu-22.04-standard`.
3. **Disk**: 20 GB.
4. **CPU**: 2 cores.
5. **Memory**: 2048 MB. Swap 512 MB.
6. **Network**: bridge to `vmbr0`, DHCP or static — whichever your homelab uses.
7. **DNS**: leave default.
8. **Confirm**, but **do not start yet**.

### Enable Docker inside the LXC

Docker needs a couple of features that aren't on by default for unprivileged LXCs. Edit the container's config from the Proxmox host:

```bash
# On the Proxmox host shell
nano /etc/pve/lxc/<CTID>.conf

# Add these three lines at the end:
features: nesting=1,keyctl=1
lxc.apparmor.profile: unconfined
lxc.cgroup2.devices.allow: a
```

Save, then start the container.

> If you're using a privileged LXC, you can drop `lxc.apparmor.profile` — but unprivileged is the default and recommended.

### Install Docker inside the LXC

SSH in (or use `pct enter <CTID>` from the Proxmox host):

```bash
apt update && apt upgrade -y
apt install -y curl ca-certificates git

# Docker's official install script
curl -fsSL https://get.docker.com | sh

# Verify
docker --version
docker compose version
```

---

## 2. Set up Cloudflare Tunnel

On the Cloudflare dashboard, go to **Zero Trust** (`one.dash.cloudflare.com`) → **Networks** → **Tunnels**.

1. **Create a tunnel** → Cloudflared → name it `hp-march-madness` → save.
2. On the **Install connector** screen, choose **Docker**. Cloudflare shows a `docker run` command containing a long token. **Copy just the token** (the part after `--token`).
3. Don't run their docker command — our `docker-compose.yml` already has the cloudflared service. Just keep that token handy for the `.env` file.
4. Click **Next**.
5. **Public Hostnames** tab → **Add a public hostname**:
   - Subdomain: `api`
   - Domain: `hpmarchmadness.org` (or whatever you use)
   - Service Type: `HTTP`
   - URL: `server:8080`
   - Save.

Cloudflare will provision a DNS record automatically. The tunnel is configured but not connected yet — it'll come up when we start docker-compose.

---

## 3. Resend setup (for magic-link emails)

1. Sign up at https://resend.com — free tier is 100 emails/day, more than enough.
2. Create an API key under **API Keys** → copy it.
3. Either:
   - **For testing**: use `onboarding@resend.dev` as the `EMAIL_FROM` — works without verifying a domain.
   - **For real**: under **Domains**, add `hpmarchmadness.org`, follow the DNS instructions in Cloudflare. Once verified, use `EMAIL_FROM="HP March Madness <pool@hpmarchmadness.org>"` or similar.

---

## 4. Clone the repo and configure

Back inside the LXC:

```bash
cd /opt
git clone https://github.com/<your-username>/HPMarchMadness.git
cd HPMarchMadness

cp .env.docker.example .env
nano .env
```

Fill in every value. Critically:

- `POSTGRES_PASSWORD` — make this strong; it never leaves the LXC.
- `SESSION_SECRET` — generate with `openssl rand -base64 48` (run that on the LXC).
- `RESEND_API_KEY` — from step 3.
- `EMAIL_FROM` — from step 3.
- `ADMIN_EMAILS` — comma-separated lowercased emails. The first email here will be the first person who can lock submissions and enter results.
- `FRONTEND_ORIGIN` — for now: `https://hpmarchmadness.org,http://localhost:5173`. The localhost entry lets you point the dev client at the live API while you're polishing.
- `CLOUDFLARE_TUNNEL_TOKEN` — from step 2.

Save and exit.

---

## 5. Bring it up

```bash
docker compose up -d --build
```

First boot takes 2–3 minutes (Docker builds the server image, postgres initializes, server runs `db:push` to create tables). Watch the logs:

```bash
docker compose logs -f server
```

You should see something like:

```
[+] Pushing schema
✓ Schema synced
API listening on http://localhost:8080
```

Now check the tunnel:

```bash
docker compose logs --tail=20 cloudflared
```

You should see registration confirmations and connections to `2 connectors` (Cloudflare's edge points). If you see DNS errors, double-check `CLOUDFLARE_TUNNEL_TOKEN`.

---

## 6. Verify the API is publicly reachable

```bash
curl https://api.hpmarchmadness.org/healthz
# → {"ok":true,"year":2026,"env":"production"}
```

If you get `Cloudflare error 1033` or similar, the tunnel hasn't fully come up yet — wait 60 seconds and retry. If it persists, check the tunnel's **Public Hostname** mapping in Cloudflare and make sure it points to `server:8080`.

Try sending yourself a magic link:

```bash
curl -X POST https://api.hpmarchmadness.org/api/auth/request-link \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
# → {"ok":true}
```

Check your inbox. The link target will be `https://api.hpmarchmadness.org/api/auth/verify?...&next=https://hpmarchmadness.org/auth/landing` — clicking it now will fail because the frontend isn't deployed yet. Move on to the frontend.

---

## 7. Deploy the frontend on Cloudflare Pages

In the Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.

1. Select your `HPMarchMadness` repo.
2. Build settings:
   - **Framework preset**: None (or Vite — either works)
   - **Build command**: `npm install && npm run build`
   - **Build output directory**: `dist`
   - **Root directory (advanced)**: `client`
3. **Environment variables** (Production):
   - `VITE_API_URL` = `https://api.hpmarchmadness.org`
4. Save and deploy.

First build takes 2–3 minutes. When it's done, Cloudflare gives you a `<project>.pages.dev` URL — visit it and confirm you see the login page.

### Custom domain

In the Pages project → **Custom domains** → **Set up a custom domain** → `hpmarchmadness.org`. Cloudflare will set up the DNS record (or warn if there's an existing one — replace it).

After DNS propagates (usually <60 seconds when CF manages the zone):

- `https://hpmarchmadness.org` → React client
- `https://api.hpmarchmadness.org/healthz` → API

Click the magic link in your inbox now and you should land on `/auth/landing`, get signed in, and end up on `/`. If your email is in `ADMIN_EMAILS` you'll see the **Admin** tab.

---

## 8. Day-2 operations

### Update the deployed code

```bash
cd /opt/HPMarchMadness
git pull
docker compose up -d --build
```

Server restarts in ~30 seconds. The frontend redeploys automatically when you push to `main` (Cloudflare Pages watches the repo).

### View logs

```bash
docker compose logs -f server
docker compose logs -f cloudflared
docker compose logs -f postgres
```

### Add or remove an admin

Edit `ADMIN_EMAILS` in `.env`, then:

```bash
docker compose up -d server
```

(No data migration — admin status is recomputed from env on each request.)

### Lock submissions / enter results

Go to `/admin` in the browser (signed in as an admin email).

### Backups

Daily pg_dump files land in `./backups/`. They're retained 30 days, oldest pruned automatically. To restore from a backup:

```bash
docker compose exec -T postgres pg_restore -U hpmm -d hpmm --clean --if-exists < backups/hpmm-YYYYMMDD-HHMMSS.dump
```

You probably also want to copy these off-box periodically — `rsync` to another server or sync to S3-compatible storage on a cron.

### Update the bracket each March

Selection Sunday rolls around → edit `server/src/config/teams.ts` → replace the placeholder roster with the real 64-team field. Push to GitHub, `git pull` on the LXC, `docker compose up -d --build`. The frontend re-pulls `/api/config/teams` on next reload, no client redeploy required.

### Roll the session secret (forces all users to sign in again)

```bash
nano .env  # replace SESSION_SECRET
docker compose up -d server
```

### Stop everything

```bash
docker compose down
# Data is preserved in the postgres_data volume and ./backups/.
```

To wipe the database (rare — destroys all entries):

```bash
docker compose down -v   # removes volumes!
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `docker: command not found` inside the LXC | Docker install failed; try `apt install -y docker.io docker-compose-v2` as a fallback |
| Server logs show `EACCES` or `Operation not permitted` | LXC needs `nesting=1,keyctl=1` features (see Step 1) |
| `cloudflared` keeps reconnecting | Token wrong, or you have two cloudflared instances using the same token. Tokens are single-instance |
| `curl /healthz` returns 200 from inside LXC but Cloudflare returns 502 | Public Hostname URL is set to `localhost:8080` instead of `server:8080` |
| Magic-link email never arrives | Resend API key wrong, or sender domain not verified — check `docker compose logs server` for Resend errors |
| `db:push` fails with "relation already exists" | Old schema mismatch; rare. `docker compose down`, fix manually, restart |
| CORS errors in browser console | `FRONTEND_ORIGIN` doesn't include the URL you're loading from. Add it to `.env` and `docker compose up -d server` |

---

## Costs

| Component | Cost |
|---|---|
| Proxmox LXC | $0 (your hardware) |
| Cloudflare account + Tunnel + Pages + DNS | $0 (free tier) |
| Resend (100 emails/day free) | $0 |
| Domain `hpmarchmadness.org` | already paid |
| **Total monthly** | **$0** |

Only paid component is the domain renewal you already have.
