/**
 * Admin routes — settings + payment status + lock/unlock submissions.
 *
 * GET   /api/admin/settings                    → all settings for current year
 * PUT   /api/admin/settings/:key               → set a value (admin only)
 * POST  /api/admin/lock                        → submissions_closed = true
 * POST  /api/admin/unlock                      → submissions_closed = false
 * PATCH /api/admin/entries/:id/payment         → mark paid / unpaid + notes
 */

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  DEFAULT_FINAL_FOUR_PAIRINGS,
  clearPairingsOverride,
  clearTeamsOverride,
  isValidPairings,
  pairingsForYear,
  setPairingsOverride,
  setTeamsOverride,
  teamsForYear,
  type FinalFourPairings,
  type Team,
} from '../config/teams.js';
import { db } from '../db/client.js';
import { appSettings, entries, results, teams as teamsTable, users } from '../db/schema.js';
import { requireAdmin, requireAuth, type AuthVariables } from '../lib/auth.js';
import { parseBracketImport } from '../lib/bracketImport.js';
import { parseEntriesImport } from '../lib/entriesImport.js';
import { parseResultsImport } from '../lib/resultsImport.js';
import { loadEnv } from '../lib/env.js';

const PaymentPatchBody = z.object({
  paymentReceived: z.boolean().optional(),
  paymentNotes: z.string().trim().max(500).nullable().optional(),
});

const SettingValueSchema = z.unknown(); // arbitrary JSON

export const adminRoutes = new Hono<{ Variables: AuthVariables }>();

// All admin routes require at least login. Specific endpoints layer on
// requireAdmin where appropriate; settings GET is admin-only too because it
// surfaces configuration that ordinary users don't need.
adminRoutes.use('*', requireAuth);

// ---------------------------------------------------------------------------
// GET /api/admin/settings   — admin only
// ---------------------------------------------------------------------------
adminRoutes.get('/settings', requireAdmin, async (c) => {
  const env = loadEnv();
  const rows = await db.select().from(appSettings).where(eq(appSettings.year, env.TOURNAMENT_YEAR));
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return c.json({ year: env.TOURNAMENT_YEAR, settings: out });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/settings/:key   — admin only
// ---------------------------------------------------------------------------
adminRoutes.put('/settings/:key', requireAdmin, async (c) => {
  const env = loadEnv();
  const user = c.get('user');
  const key = c.req.param('key');
  const year = env.TOURNAMENT_YEAR;
  const body = await c.req.json().catch(() => null);
  const parsed = SettingValueSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input' }, 400);
  }
  const value = (body as { value?: unknown })?.value ?? body;

  const [existing] = await db
    .select()
    .from(appSettings)
    .where(and(eq(appSettings.year, year), eq(appSettings.key, key)))
    .limit(1);

  if (existing) {
    await db
      .update(appSettings)
      .set({ value: value as object, updatedAt: new Date(), updatedByUserId: user.id })
      .where(and(eq(appSettings.year, year), eq(appSettings.key, key)));
  } else {
    await db.insert(appSettings).values({
      year,
      key,
      value: value as object,
      updatedByUserId: user.id,
    });
  }
  return c.json({ ok: true, year, key, value });
});

// ---------------------------------------------------------------------------
// POST /api/admin/lock   — admin only — close submissions
// ---------------------------------------------------------------------------
adminRoutes.post('/lock', requireAdmin, async (c) => {
  const env = loadEnv();
  const user = c.get('user');
  await upsertSetting(env.TOURNAMENT_YEAR, 'submissions_closed', true, user.id);
  return c.json({ ok: true, submissionsClosed: true });
});

// ---------------------------------------------------------------------------
// POST /api/admin/unlock   — admin only — reopen submissions
// ---------------------------------------------------------------------------
adminRoutes.post('/unlock', requireAdmin, async (c) => {
  const env = loadEnv();
  const user = c.get('user');
  await upsertSetting(env.TOURNAMENT_YEAR, 'submissions_closed', false, user.id);
  return c.json({ ok: true, submissionsClosed: false });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/entries/:id/payment   — admin only
// ---------------------------------------------------------------------------
adminRoutes.patch('/entries/:id/payment', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = PaymentPatchBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }

  const [entry] = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  if (!entry) return c.json({ error: 'not_found' }, 404);

  const patch: Partial<typeof entries.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.paymentReceived !== undefined) {
    patch.paymentReceived = parsed.data.paymentReceived;
    patch.paymentReceivedAt = parsed.data.paymentReceived ? new Date() : null;
  }
  if (parsed.data.paymentNotes !== undefined) {
    patch.paymentNotes = parsed.data.paymentNotes;
  }

  const [updated] = await db.update(entries).set(patch).where(eq(entries.id, id)).returning();
  return c.json({ entry: updated });
});

// ---------------------------------------------------------------------------
// GET /api/admin/bracket   — admin only — returns current bracket roster
// ---------------------------------------------------------------------------
adminRoutes.get('/bracket', requireAdmin, async (c) => {
  const env = loadEnv();
  const yearParam = c.req.query('year');
  const year = yearParam ? Number.parseInt(yearParam, 10) : env.TOURNAMENT_YEAR;
  if (!Number.isFinite(year)) {
    return c.json({ error: 'invalid_year' }, 400);
  }

  try {
    const list = teamsForYear(year);
    return c.json({
      year,
      hasUploaded: list.length > 0,
      teams: list,
    });
  } catch {
    // No bracket configured at all (neither DB nor code).
    return c.json({ year, hasUploaded: false, teams: [] });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/bracket   — admin only — replace bracket for a year
//
// Body: { year: number, text: string }
//   The `text` is the raw pasted CSV-ish input (see lib/bracketImport.ts for
//   the accepted format). Server parses + validates + persists atomically.
// ---------------------------------------------------------------------------
const PutBracketBody = z.object({
  year: z.number().int().min(2024).max(2100),
  text: z.string().min(1).max(20_000),
});

adminRoutes.put('/bracket', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = PutBracketBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }

  const result = parseBracketImport(parsed.data.text);
  if (!result.ok) {
    return c.json({ error: 'validation_failed', issues: result.errors }, 400);
  }

  const { year } = parsed.data;
  const newTeams: Team[] = result.teams;

  // Replace atomically: delete existing year + insert new rows in one transaction.
  await db.transaction(async (tx) => {
    await tx.delete(teamsTable).where(eq(teamsTable.year, year));
    if (newTeams.length > 0) {
      await tx.insert(teamsTable).values(
        newTeams.map((t) => ({
          id: t.id,
          year,
          seed: t.seed,
          region: t.region,
          side: t.side,
          name: t.name,
        })),
      );
    }
  });

  // Refresh the in-memory cache so synchronous teamsForYear() sees the change
  // without a server restart.
  setTeamsOverride(year, newTeams);

  return c.json({ ok: true, year, count: newTeams.length, teams: newTeams });
});

// ---------------------------------------------------------------------------
// GET /api/admin/pairings   — admin only — current Final Four pairings
// ---------------------------------------------------------------------------
adminRoutes.get('/pairings', requireAdmin, async (c) => {
  const env = loadEnv();
  const yearParam = c.req.query('year');
  const year = yearParam ? Number.parseInt(yearParam, 10) : env.TOURNAMENT_YEAR;
  if (!Number.isFinite(year)) return c.json({ error: 'invalid_year' }, 400);

  const pairings = pairingsForYear(year);
  return c.json({
    year,
    pairings,
    isDefault: pairings === DEFAULT_FINAL_FOUR_PAIRINGS,
  });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/pairings   — admin only — set Final Four pairings for a year
// ---------------------------------------------------------------------------
const PutPairingsBody = z.object({
  year: z.number().int().min(2000).max(2100),
  pairings: z.array(z.array(z.string()).length(2)).length(2),
});

adminRoutes.put('/pairings', requireAdmin, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = PutPairingsBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }

  const candidate = parsed.data.pairings;
  if (!isValidPairings(candidate)) {
    return c.json(
      {
        error: 'invalid_pairings',
        message: 'Pairings must use each region (South, West, Midwest, East) exactly once.',
      },
      400,
    );
  }
  const pairings = candidate as FinalFourPairings;

  await upsertSetting(parsed.data.year, 'final_four_pairings', pairings, user.id);
  setPairingsOverride(parsed.data.year, pairings);
  return c.json({ ok: true, year: parsed.data.year, pairings });
});

// ---------------------------------------------------------------------------
// POST /api/admin/import/entries   — admin only — bulk-import historical entries
//
// Body: { year: number, text: string }
//   The `text` is a tab-separated paste from a Google Sheet Form Responses tab.
//   Server parses each row, resolves team strings to IDs against the year's
//   bracket, finds-or-creates users by email, and inserts entries atomically.
//
// Behavior on conflict:
//   - Wipes any existing entries for the given year before inserting.
//     This makes re-imports idempotent — fix typos, paste again.
// ---------------------------------------------------------------------------
const ImportEntriesBody = z.object({
  year: z.number().int().min(2000).max(2100),
  text: z.string().min(1).max(200_000),
});

adminRoutes.post('/import/entries', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ImportEntriesBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }
  const { year, text } = parsed.data;

  let yearTeams: readonly Team[] = [];
  try {
    yearTeams = teamsForYear(year);
  } catch {
    return c.json(
      {
        error: 'no_bracket_for_year',
        message: `No bracket configured for ${year}. Upload teams via Bracket Setup first.`,
      },
      400,
    );
  }

  const result = parseEntriesImport(text, year, yearTeams);
  if (!result.ok) {
    return c.json({ error: 'validation_failed', issues: result.errors }, 400);
  }

  // Look up or create users by email (deduped across the import).
  const emailToUserId = new Map<string, string>();
  await db.transaction(async (tx) => {
    // Wipe existing entries for the year so re-imports are idempotent.
    await tx.delete(entries).where(eq(entries.year, year));

    for (const e of result.entries) {
      let userId = emailToUserId.get(e.email);
      if (!userId) {
        const [existing] = await tx.select().from(users).where(eq(users.email, e.email)).limit(1);
        if (existing) {
          userId = existing.id;
        } else {
          const [created] = await tx.insert(users).values({ email: e.email }).returning();
          if (!created) throw new Error(`Failed to create user ${e.email}`);
          userId = created.id;
        }
        emailToUserId.set(e.email, userId);
      }

      await tx.insert(entries).values({
        userId,
        year,
        displayName: e.displayName,
        picks: e.picks,
        paymentMethod: e.paymentMethod,
        paymentMethodNote: e.paymentMethodNote,
      });
    }
  });

  return c.json({
    ok: true,
    year,
    imported: result.entries.length,
    users: emailToUserId.size,
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/import/results   — admin only — bulk-import historical results
//
// Body: { year: number, text: string }
//   The `text` is a round-by-round paste (see lib/resultsImport.ts for format).
//   Server parses + resolves team names + writes results atomically. Wipes any
//   existing results for the year first so re-imports are idempotent.
// ---------------------------------------------------------------------------
const ImportResultsBody = z.object({
  year: z.number().int().min(2000).max(2100),
  text: z.string().min(1).max(100_000),
});

adminRoutes.post('/import/results', requireAdmin, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = ImportResultsBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }
  const { year, text } = parsed.data;

  let yearTeams: readonly Team[] = [];
  try {
    yearTeams = teamsForYear(year);
  } catch {
    return c.json(
      {
        error: 'no_bracket_for_year',
        message: `No bracket configured for ${year}. Upload teams via Bracket Setup first.`,
      },
      400,
    );
  }

  const pairings = pairingsForYear(year);
  const result = parseResultsImport(text, year, yearTeams, pairings);
  if (!result.ok) {
    return c.json({ error: 'validation_failed', issues: result.errors }, 400);
  }

  await db.transaction(async (tx) => {
    await tx.delete(results).where(eq(results.year, year));
    for (const r of result.results) {
      await tx.insert(results).values({
        year,
        gameId: r.gameId,
        winnerTeamId: r.winnerTeamId,
        recordedByUserId: user.id,
      });
    }
  });

  return c.json({ ok: true, year, imported: result.results.length });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/year/:year/:scope   — admin only — reset data for a year
//
// :scope is one of:
//   results   — wipe only game results
//   entries   — wipe only entries (also affects any leaderboard scoring)
//   bracket   — wipe teams + Final Four pairings + app_settings for the year
//   all       — wipe everything for the year (results + entries + bracket)
//
// Requires `?confirm=YEAR` query param matching the year, as a guardrail.
// ---------------------------------------------------------------------------
const ResetScopes = new Set(['results', 'entries', 'bracket', 'all'] as const);

adminRoutes.delete('/year/:year/:scope', requireAdmin, async (c) => {
  const yearStr = c.req.param('year');
  const scope = c.req.param('scope');
  const year = Number.parseInt(yearStr, 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return c.json({ error: 'invalid_year', got: yearStr }, 400);
  }
  if (!ResetScopes.has(scope as 'results' | 'entries' | 'bracket' | 'all')) {
    return c.json({ error: 'invalid_scope', got: scope }, 400);
  }
  const confirm = c.req.query('confirm');
  if (confirm !== String(year)) {
    return c.json(
      { error: 'missing_confirmation', message: `Pass ?confirm=${year} to proceed.` },
      400,
    );
  }

  const deleted = { results: 0, entries: 0, teams: 0, settings: 0 };

  await db.transaction(async (tx) => {
    if (scope === 'results' || scope === 'all') {
      const out = await tx.delete(results).where(eq(results.year, year)).returning({ id: results.id });
      deleted.results = out.length;
    }
    if (scope === 'entries' || scope === 'all') {
      const out = await tx.delete(entries).where(eq(entries.year, year)).returning({ id: entries.id });
      deleted.entries = out.length;
    }
    if (scope === 'bracket' || scope === 'all') {
      const tOut = await tx.delete(teamsTable).where(eq(teamsTable.year, year)).returning({ id: teamsTable.id });
      deleted.teams = tOut.length;
      const sOut = await tx
        .delete(appSettings)
        .where(eq(appSettings.year, year))
        .returning({ key: appSettings.key });
      deleted.settings = sOut.length;
    }
  });

  // Refresh in-memory caches that mirror DB state.
  if (scope === 'bracket' || scope === 'all') {
    clearTeamsOverride(year);
    clearPairingsOverride(year);
  }

  return c.json({ ok: true, year, scope, deleted });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function upsertSetting(year: number, key: string, value: unknown, userId: string) {
  const [existing] = await db
    .select()
    .from(appSettings)
    .where(and(eq(appSettings.year, year), eq(appSettings.key, key)))
    .limit(1);
  if (existing) {
    await db
      .update(appSettings)
      .set({ value: value as object, updatedAt: new Date(), updatedByUserId: userId })
      .where(and(eq(appSettings.year, year), eq(appSettings.key, key)));
  } else {
    await db.insert(appSettings).values({ year, key, value: value as object, updatedByUserId: userId });
  }
}
