/**
 * Results routes.
 *
 * GET    /api/results               → public-ish (login-required) read of all
 *                                     entered winners for the current year.
 * PUT    /api/results/:gameId       → upsert a winner (admin only)
 * DELETE /api/results/:gameId       → clear a winner (admin only)
 *
 * Game IDs follow the format defined in config/teams.ts (e.g.
 * `south-r1-g1`, `final-four-2`, `championship`).
 */

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client.js';
import { results } from '../db/schema.js';
import { requireAdmin, requireAuth, type AuthVariables } from '../lib/auth.js';
import { loadEnv } from '../lib/env.js';
import { unknownGameIds, validGameIdSet } from '../lib/scoring.js';
import { teamMapForYear } from '../config/teams.js';

const SetWinnerBody = z.object({
  winnerTeamId: z.string().min(1),
});

export const resultsRoutes = new Hono<{ Variables: AuthVariables }>();

// All result endpoints require at least login.
resultsRoutes.use('*', requireAuth);

// ---------------------------------------------------------------------------
// GET /api/results
// ---------------------------------------------------------------------------
resultsRoutes.get('/', async (c) => {
  const env = loadEnv();
  const rows = await db.select().from(results).where(eq(results.year, env.TOURNAMENT_YEAR));
  return c.json({
    year: env.TOURNAMENT_YEAR,
    results: rows.map((r) => ({
      gameId: r.gameId,
      winnerTeamId: r.winnerTeamId,
      recordedAt: r.recordedAt,
    })),
  });
});

// ---------------------------------------------------------------------------
// PUT /api/results/:gameId   — admin only
// ---------------------------------------------------------------------------
resultsRoutes.put('/:gameId', requireAdmin, async (c) => {
  const env = loadEnv();
  const user = c.get('user');
  const gameId = c.req.param('gameId');
  const year = env.TOURNAMENT_YEAR;

  // Validate game ID against this year's bracket.
  const bad = unknownGameIds(year, [gameId]);
  if (bad.length > 0) {
    return c.json({ error: 'unknown_game_id', gameId }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = SetWinnerBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }

  // Validate winner team belongs to this year.
  const teamMap = teamMapForYear(year);
  if (!teamMap.has(parsed.data.winnerTeamId)) {
    return c.json({ error: 'unknown_team', teamId: parsed.data.winnerTeamId }, 400);
  }

  // Upsert: try update, then insert if no row.
  const [existing] = await db
    .select()
    .from(results)
    .where(and(eq(results.year, year), eq(results.gameId, gameId)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(results)
      .set({
        winnerTeamId: parsed.data.winnerTeamId,
        recordedAt: new Date(),
        recordedByUserId: user.id,
      })
      .where(eq(results.id, existing.id))
      .returning();
    return c.json({ result: updated });
  }
  const [inserted] = await db
    .insert(results)
    .values({
      year,
      gameId,
      winnerTeamId: parsed.data.winnerTeamId,
      recordedByUserId: user.id,
    })
    .returning();
  return c.json({ result: inserted }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /api/results/:gameId   — admin only
// ---------------------------------------------------------------------------
resultsRoutes.delete('/:gameId', requireAdmin, async (c) => {
  const env = loadEnv();
  const gameId = c.req.param('gameId');
  const year = env.TOURNAMENT_YEAR;

  // Quick sanity-check; not strictly necessary but consistent with PUT.
  if (!validGameIdSet(year).has(gameId)) {
    return c.json({ error: 'unknown_game_id', gameId }, 400);
  }

  await db.delete(results).where(and(eq(results.year, year), eq(results.gameId, gameId)));
  return c.json({ ok: true });
});
