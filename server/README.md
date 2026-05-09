# HP March Madness — Server

Backend API for Henry Pearson's March Madness Bracket Challenge.

Stack: **Node 20 + Hono + Drizzle ORM + Postgres**, magic-link auth via **Resend**, deployed on **Render**.

---

## Local development

```bash
cd server
npm install
cp .env.example .env
# Fill in .env (DATABASE_URL pointing at a local Postgres works fine)

npm run db:generate   # generate SQL migrations from schema.ts
npm run db:migrate    # apply them
npm run dev           # start the API on http://localhost:8080
```

Hit `http://localhost:8080/healthz` — should return `{ ok: true, ... }`.

If you don't have Postgres locally, the easiest path is Docker:

```bash
docker run --name hp-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
# then in .env: DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
```

## Project layout

```
server/
├── src/
│   ├── index.ts          # Hono app entry, CORS, /healthz, mounts route modules
│   ├── lib/
│   │   └── env.ts        # Zod-validated env loader
│   └── db/
│       ├── schema.ts     # Drizzle table definitions
│       ├── client.ts     # Postgres pool + Drizzle wrapper
│       └── migrate.ts    # Migration runner (npm run db:migrate)
├── drizzle/              # Generated SQL migrations (committed)
├── drizzle.config.ts
├── .env.example
└── package.json
```

Future modules (added milestone by milestone): `lib/auth.ts`, `lib/scoring.ts`, `lib/email.ts`, `routes/auth.ts`, `routes/entries.ts`, `routes/results.ts`, `routes/admin.ts`, `routes/config.ts`, `config/teams.ts`.

## Data model summary

| Table | Purpose |
|---|---|
| `users` | One row per email. Auth identity. |
| `magic_links` | One-time sign-in tokens (hashed). |
| `entries` | Bracket submissions. Picks stored as jsonb. Includes payment tracking. |
| `results` | Game winners entered by admins. Keyed `R{round}-S{slot}` per year. |
| `app_settings` | Year-scoped key/value (e.g. `submissions_closed`). |

Notes worth knowing:

- **A user can submit multiple entries.** No unique (user_id, year) constraint — past pools regularly had one person submitting on behalf of family members.
- **Tiebreakers are computed, not stored.** Tied entries are broken by per-round score (R1 first, then R2, ...).
- **Team data is code-side**, not in the DB. See `config/teams.ts` (added in Milestone 3). Easier to refresh per tournament than admin UI for team management.

## Deploying to Render

Detailed deploy instructions land in Milestone 6. The short version:

1. Create a Render **Postgres** instance — copy its **Internal Database URL**.
2. Create a Render **Web Service** pointing at this repo, root directory `server/`.
3. Build command: `npm install && npm run build`
4. Pre-Deploy command: `npm run db:migrate`
5. Start command: `npm start`
6. Set env vars from `.env.example` (DATABASE_URL, SESSION_SECRET, RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAILS, FRONTEND_ORIGIN).

Render's free tier sleeps after 15 min idle (~30s cold start). Free Postgres expires after 90 days. Plan to upgrade (~$14/mo) before tournament time.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Hot-reload dev server via `tsx watch` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output (used in production) |
| `npm run db:generate` | Generate SQL migrations from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |
| `npm test` | Run Vitest suite |
| `npm run typecheck` | TypeScript without emitting |
