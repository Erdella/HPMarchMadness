/**
 * Leaderboard route.
 *
 * GET /api/leaderboard → computed standings for the current year (login required)
 *
 * Computation is done at request time, not stored. With <500 entries this is
 * trivially fast and removes a class of "stale denormalized totals" bugs.
 */

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client.js';
import { entries, results } from '../db/schema.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { computeStandings, winnerMapFromResults } from '../lib/scoring.js';
import { readYear } from '../lib/year.js';

export const leaderboardRoutes = new Hono<{ Variables: AuthVariables }>();
leaderboardRoutes.use('*', requireAuth);

leaderboardRoutes.get('/', async (c) => {
  const y = readYear(c);
  if (!y.ok) return y.response;
  const year = y.year;

  const [entryRows, resultRows] = await Promise.all([
    db.select().from(entries).where(eq(entries.year, year)),
    db.select().from(results).where(eq(results.year, year)),
  ]);

  const winnerMap = winnerMapFromResults(
    resultRows.map((r) => ({ gameId: r.gameId, winnerTeamId: r.winnerTeamId })),
  );

  const standings = computeStandings(
    year,
    entryRows.map((e) => ({
      entryId: e.id,
      displayName: e.displayName,
      picks: e.picks,
    })),
    winnerMap,
  );

  return c.json({
    year,
    totalEntries: entryRows.length,
    standings,
  });
});
