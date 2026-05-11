/**
 * HP March Madness API entry point.
 *
 * Boots a Hono app with CORS configured for the frontend origin(s) and exposes
 * a /healthz endpoint for uptime checks. Route modules will be wired in here
 * milestone by milestone.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { replaceTeamsOverride, type Team } from './config/teams.js';
import { db, sql as dbSql } from './db/client.js';
import { teams as teamsTable } from './db/schema.js';
import { loadEnv } from './lib/env.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { configRoutes } from './routes/config.js';
import { entriesRoutes } from './routes/entries.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { resultsRoutes } from './routes/results.js';

const env = loadEnv();

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => (env.FRONTEND_ORIGIN.includes(origin) ? origin : null),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
);

// Liveness — used by Render's health-check pings and any uptime monitor.
app.get('/healthz', async (c) => {
  try {
    // Touch the DB so we don't lie about being healthy if Postgres is down.
    await dbSql`select 1`;
    return c.json({
      ok: true,
      year: env.TOURNAMENT_YEAR,
      env: env.NODE_ENV,
    });
  } catch (err) {
    console.error('healthz: db check failed', err);
    return c.json({ ok: false, reason: 'db_unreachable' }, 503);
  }
});

// Root — friendly hint for anyone who lands on the bare URL.
app.get('/', (c) =>
  c.json({
    name: 'hp-march-madness-api',
    docs: 'See /healthz for liveness. All app routes are under /api.',
  }),
);

app.route('/api/auth', authRoutes);
app.route('/api/config', configRoutes);
app.route('/api/entries', entriesRoutes);
app.route('/api/results', resultsRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/leaderboard', leaderboardRoutes);

// -----------------------------------------------------------------------------
// Load any admin-uploaded brackets from DB into the in-memory cache, then boot.
// -----------------------------------------------------------------------------
async function bootTeamsCache(): Promise<void> {
  try {
    const rows = await db.select().from(teamsTable);
    const byYear: Record<number, Team[]> = {};
    for (const r of rows) {
      const list = byYear[r.year] ?? (byYear[r.year] = []);
      list.push({
        id: r.id,
        name: r.name,
        seed: r.seed,
        region: r.region as Team['region'],
        side: r.side as Team['side'],
      });
    }
    replaceTeamsOverride(byYear);
    const years = Object.keys(byYear);
    if (years.length > 0) {
      console.log(`Bracket cache: loaded ${rows.length} teams across ${years.length} year(s) — ${years.join(', ')}`);
    } else {
      console.log('Bracket cache: empty (using code-side fallback in config/teams.ts)');
    }
  } catch (err) {
    console.error('Failed to prime bracket cache; falling back to code defaults.', err);
  }
}

const port = env.PORT;

bootTeamsCache().then(() => {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  });
});

export default app;
