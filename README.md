# HP March Madness

Henry Pearson's March Madness Bracket Challenge — annual NCAA tournament pool benefiting [RBI (Reviving Baseball in Inner Cities)](https://www.mlb.com/mlb-community/reviving-baseball-inner-cities) in Henry's name.

> *In memory of Henry Pearson · 16th annual · 2026*

## Repo layout

```
HPMarchMadness/
├── server/                Node + Hono + Drizzle API
│   ├── src/
│   ├── Dockerfile
│   └── README.md          local dev guide for the server
├── client/                Vite + React + TS frontend (ASU palette)
│   ├── src/
│   └── README.md          local dev guide for the client
├── docker-compose.yml     full prod stack (postgres + server + cloudflared + backup)
├── .env.docker.example    prod env template
├── DEPLOY.md              step-by-step Proxmox + Cloudflare Tunnel deploy
├── index.html             original single-file app (kept for history)
└── README.md              this file
```

## Quick start (local dev)

```bash
# Terminal 1 — start Postgres
docker run --name hp-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16

# Terminal 2 — server
cd server
npm install
cp .env.example .env       # fill in DATABASE_URL, SESSION_SECRET, RESEND_API_KEY, ADMIN_EMAILS
npm run db:push
npm run dev                # http://localhost:8080

# Terminal 3 — client
cd client
npm install
cp .env.example .env       # leave VITE_API_URL=http://localhost:8080
npm run dev                # http://localhost:5173
```

Visit `http://localhost:5173`, request a magic link with your email — the link prints to the **server** terminal in dev mode (so you can copy/paste without waiting for email).

For the full stack: see [DEPLOY.md](./DEPLOY.md).

## Architecture

```
Browser ──► hpmarchmadness.org           ─→ Cloudflare Pages (React client)
        ──► api.hpmarchmadness.org       ─→ Cloudflare Tunnel
                                          ─→ LXC on Proxmox
                                              ├── cloudflared
                                              ├── server (Node API)
                                              ├── postgres
                                              └── backup (daily pg_dump)
```

- **Frontend** statically built and edge-hosted; auto-deploys on push to `main`.
- **Backend** in your homelab; never exposes inbound ports — Cloudflare Tunnel handles ingress.
- **Auth** is magic-link email (Resend) → JWT session in `localStorage` → `Authorization: Bearer` header.
- **Admin** powers are gated by `ADMIN_EMAILS` env var, not a DB flag — rotate by editing env.
- **Tournament data** (64 teams, bracket pairings) lives in code (`server/src/config/teams.ts`); update once a year, redeploy.

## Pool rules

15 teams per entry, distributed across seed buckets:

| Bucket | Picks |
|---|---|
| #1 seed | 1 |
| #2–3 seeds | 2 |
| #4–7 seeds | 3 |
| #8–11 seeds | 4 |
| #12–16 seeds | 5 |

Scoring per round-win: **1 / 2 / 4 / 6 / 8 / 12** (R1 → Championship).

Tiebreaker: total points, then R1 points, R2 points, … each round in turn.

Entry fee: **$20** (Venmo / PayPal / mail-a-check). **$2** of each donated to RBI.

## Credits

Pool created and run annually by **Brett Henry**. Memorialized for **Henry Pearson** (1986–2009).
