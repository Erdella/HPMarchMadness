/**
 * Entry CRUD.
 *
 * POST   /api/entries        → create a new entry (login required)
 * GET    /api/entries        → list ALL entries for the current year (login required)
 * GET    /api/entries/me     → list entries owned by the current user
 * GET    /api/entries/:id    → fetch a single entry
 * PATCH  /api/entries/:id    → update display name / picks / payment method
 *                              (owner only, only while submissions open)
 * DELETE /api/entries/:id    → delete an entry (owner only, only while open)
 *
 * Submission lock:
 *   When app_settings(year, submissions_closed) is true, only admins can
 *   create or modify entries. Read endpoints always work for any logged-in
 *   user — that's how the leaderboard surfaces who picked what.
 */

import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { PAYMENT_METHODS } from '../db/schema.js';
import { db } from '../db/client.js';
import { appSettings, entries } from '../db/schema.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { loadEnv } from '../lib/env.js';
import { validatePicks } from '../lib/validation.js';
import { readYear } from '../lib/year.js';

const PicksSchema = z.array(z.string().min(1)).min(1);
const PaymentMethodSchema = z.enum(PAYMENT_METHODS);

const CreateEntryBody = z.object({
  displayName: z.string().trim().min(1).max(120),
  picks: PicksSchema,
  paymentMethod: PaymentMethodSchema,
  paymentMethodNote: z.string().trim().max(500).optional().nullable(),
});

const UpdateEntryBody = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  picks: PicksSchema.optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  paymentMethodNote: z.string().trim().max(500).nullable().optional(),
});

export const entriesRoutes = new Hono<{ Variables: AuthVariables }>();
entriesRoutes.use('*', requireAuth);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isSubmissionsClosed(year: number): Promise<boolean> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(and(eq(appSettings.year, year), eq(appSettings.key, 'submissions_closed')))
    .limit(1);
  return Boolean(row?.value === true || (row?.value as { value?: boolean })?.value === true);
}

// ---------------------------------------------------------------------------
// POST /api/entries
// ---------------------------------------------------------------------------
entriesRoutes.post('/', async (c) => {
  const env = loadEnv();
  const user = c.get('user');
  const isAdmin = c.get('isAdmin');
  const year = env.TOURNAMENT_YEAR;

  const body = await c.req.json().catch(() => null);
  const parsed = CreateEntryBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }
  const input = parsed.data;

  if (!isAdmin && (await isSubmissionsClosed(year))) {
    return c.json({ error: 'submissions_closed' }, 403);
  }

  const validation = validatePicks(year, input.picks);
  if (!validation.ok) {
    return c.json({ error: validation.code, message: validation.message }, 400);
  }

  const [created] = await db
    .insert(entries)
    .values({
      userId: user.id,
      year,
      displayName: input.displayName,
      picks: input.picks as string[],
      paymentMethod: input.paymentMethod,
      paymentMethodNote: input.paymentMethodNote ?? null,
    })
    .returning();

  return c.json({ entry: created }, 201);
});

// ---------------------------------------------------------------------------
// GET /api/entries
// ---------------------------------------------------------------------------
entriesRoutes.get('/', async (c) => {
  const isAdmin = c.get('isAdmin');
  const y = readYear(c);
  if (!y.ok) return y.response;
  const year = y.year;

  const rows = await db
    .select()
    .from(entries)
    .where(eq(entries.year, year))
    .orderBy(desc(entries.submittedAt));

  // Non-admins shouldn't see other users' payment notes / unpaid status. Strip those fields.
  if (!isAdmin) {
    return c.json({
      entries: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        year: r.year,
        displayName: r.displayName,
        picks: r.picks,
        submittedAt: r.submittedAt,
      })),
    });
  }
  return c.json({ entries: rows });
});

// ---------------------------------------------------------------------------
// GET /api/entries/me
// ---------------------------------------------------------------------------
entriesRoutes.get('/me', async (c) => {
  const user = c.get('user');
  const y = readYear(c);
  if (!y.ok) return y.response;
  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.userId, user.id), eq(entries.year, y.year)))
    .orderBy(desc(entries.submittedAt));
  return c.json({ entries: rows });
});

// ---------------------------------------------------------------------------
// GET /api/entries/:id
// ---------------------------------------------------------------------------
entriesRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const isAdmin = c.get('isAdmin');
  const user = c.get('user');

  const [entry] = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  if (!entry) return c.json({ error: 'not_found' }, 404);

  // Non-admin viewing someone else's entry: redact payment fields.
  if (!isAdmin && entry.userId !== user.id) {
    return c.json({
      entry: {
        id: entry.id,
        userId: entry.userId,
        year: entry.year,
        displayName: entry.displayName,
        picks: entry.picks,
        submittedAt: entry.submittedAt,
      },
    });
  }
  return c.json({ entry });
});

// ---------------------------------------------------------------------------
// PATCH /api/entries/:id
// ---------------------------------------------------------------------------
entriesRoutes.patch('/:id', async (c) => {
  const env = loadEnv();
  const id = c.req.param('id');
  const user = c.get('user');
  const isAdmin = c.get('isAdmin');
  const year = env.TOURNAMENT_YEAR;

  const body = await c.req.json().catch(() => null);
  const parsed = UpdateEntryBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }

  const [entry] = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  if (!entry) return c.json({ error: 'not_found' }, 404);
  if (entry.userId !== user.id && !isAdmin) return c.json({ error: 'forbidden' }, 403);
  if (!isAdmin && (await isSubmissionsClosed(year))) {
    return c.json({ error: 'submissions_closed' }, 403);
  }

  if (parsed.data.picks) {
    const validation = validatePicks(entry.year, parsed.data.picks);
    if (!validation.ok) {
      return c.json({ error: validation.code, message: validation.message }, 400);
    }
  }

  const [updated] = await db
    .update(entries)
    .set({
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.picks !== undefined ? { picks: parsed.data.picks as string[] } : {}),
      ...(parsed.data.paymentMethod !== undefined
        ? { paymentMethod: parsed.data.paymentMethod }
        : {}),
      ...(parsed.data.paymentMethodNote !== undefined
        ? { paymentMethodNote: parsed.data.paymentMethodNote }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(entries.id, id))
    .returning();

  return c.json({ entry: updated });
});

// ---------------------------------------------------------------------------
// DELETE /api/entries/:id
// ---------------------------------------------------------------------------
entriesRoutes.delete('/:id', async (c) => {
  const env = loadEnv();
  const id = c.req.param('id');
  const user = c.get('user');
  const isAdmin = c.get('isAdmin');
  const year = env.TOURNAMENT_YEAR;

  const [entry] = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  if (!entry) return c.json({ error: 'not_found' }, 404);
  if (entry.userId !== user.id && !isAdmin) return c.json({ error: 'forbidden' }, 403);
  if (!isAdmin && (await isSubmissionsClosed(year))) {
    return c.json({ error: 'submissions_closed' }, 403);
  }

  await db.delete(entries).where(eq(entries.id, id));
  return c.json({ ok: true });
});
