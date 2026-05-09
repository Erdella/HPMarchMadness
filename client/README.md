# HP March Madness — Client

React + Vite + TypeScript frontend for Henry Pearson's March Madness Bracket Challenge.

Stack: **Vite 5 + React 18 + TypeScript + Tailwind CSS + React Router**, deployed on **Cloudflare Pages**.

Design: ASU Sun Devils palette — maroon (#8C1D40) on near-black (#0F0709) with gold (#FFC627) accents, condensed display type for headers, monospace for stats.

## Local development

```bash
cd client
npm install
cp .env.example .env
# .env defaults VITE_API_URL=http://localhost:8080 — leave it for local dev

npm run dev
# Open http://localhost:5173
```

The app expects the API to be running locally on `:8080`. To start the server:

```bash
cd ../server
npm run dev
```

Make sure the server's `FRONTEND_ORIGIN` env var includes `http://localhost:5173` (the default in `.env.example` already does this).

## Project layout

```
client/
├── index.html              # Vite entry HTML
├── vite.config.ts
├── tailwind.config.ts      # ASU palette + display/mono fonts
├── postcss.config.js
├── .env.example
├── src/
│   ├── main.tsx            # React root
│   ├── App.tsx             # Route table
│   ├── index.css           # Tailwind directives + design tokens + components
│   ├── lib/
│   │   ├── api.ts          # fetch wrapper, bearer-token storage
│   │   ├── auth.tsx        # AuthProvider / useAuth
│   │   └── config.tsx      # ConfigProvider / useConfig (pulls /api/config)
│   ├── components/
│   │   ├── Layout.tsx      # header + nav + footer shell
│   │   └── RequireAuth.tsx # route guard, supports adminOnly
│   └── pages/
│       ├── Login.tsx       # magic-link request
│       ├── AuthLanding.tsx # consumes session= from URL hash
│       ├── Home.tsx        # dashboard for signed-in user
│       ├── Draft.tsx       # bracket builder (M5: full implementation)
│       ├── Leaderboard.tsx # standings list (M5: filters + per-round breakdown)
│       └── Admin.tsx       # tournament controls (M5: full implementation)
└── package.json
```

## Auth flow

1. User goes to `/login`, types email, clicks "Send sign-in link".
2. Frontend calls `POST /api/auth/request-link { email, next: "<origin>/auth/landing" }`.
3. Server emails a one-time link `https://api.../api/auth/verify?token=...&next=<origin>/auth/landing`.
4. User clicks the email link. Server validates, signs a JWT, redirects to `<origin>/auth/landing#session=<jwt>`.
5. `AuthLanding` reads `window.location.hash`, calls `acceptToken()`, strips the hash via `history.replaceState`, redirects to `/draft`.
6. `AuthProvider` stores the token in `localStorage` under `hp-mm-session` and attaches it as `Authorization: Bearer <jwt>` on every API call.
7. Token is a 30-day JWT signed with `SESSION_SECRET`. A 401 from the API auto-clears it.

## Build for production

```bash
npm run build
# Outputs to client/dist/
```

For Cloudflare Pages deploy, set the build env var:
```
VITE_API_URL=https://api.hpmarchmadness.org
```

Pages settings:
- Build command: `npm run build`
- Build output: `client/dist`
- Root directory: `client`

## What's already wired

- ASU design system (palette + fonts + base components)
- Magic-link login + session storage + auto-refresh on boot
- Pool config provider — every screen has scoring, buckets, copy without re-fetching
- Header navigation, role-aware (Admin tab only shows for admins)
- Route guards (`RequireAuth`, `RequireAuth adminOnly`)
- Stub pages for Draft / Leaderboard / Admin — Leaderboard already pulls real standings

## What ships in M5

- Full draft UI (region tabs, 64-team picker grid, bucket counters)
- Submit / edit / delete entries with validation feedback
- Admin: results entry per game, lock/unlock submissions, payment dashboard
- Leaderboard filters, per-round breakdown, top-3 highlight
