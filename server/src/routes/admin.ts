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
import { db } from '../db/client.js';
import { appSettings, entries } from '../db/schema.js';
import { requireAdmin, requireAuth, type AuthVariables } from '../lib/auth.js';
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
