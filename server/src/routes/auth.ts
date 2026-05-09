/**
 * Auth routes.
 *
 * POST /api/auth/request-link  → emails a one-time sign-in link
 * GET  /api/auth/verify        → exchanges a magic-link token for a session JWT
 *                                and redirects back to the frontend
 * GET  /api/auth/me            → returns the current user (requires auth)
 * POST /api/auth/logout        → no-op server-side; the frontend just drops
 *                                its stored token. Endpoint exists so the
 *                                client can record it for analytics later.
 */

import { and, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client.js';
import { magicLinks, users } from '../db/schema.js';
import {
  MAGIC_LINK_EXPIRY_MS,
  MAGIC_LINK_TTL_MINUTES,
  generateMagicLinkToken,
  requireAuth,
  sha256,
  signSession,
  type AuthVariables,
} from '../lib/auth.js';
import { sendMagicLinkEmail } from '../lib/email.js';
import { isAdminEmail, loadEnv } from '../lib/env.js';

const RequestLinkBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Where to send the user after they click the link. Must be one of our
  // allowed frontend origins (validated below) — prevents open-redirect abuse.
  next: z.string().url().optional(),
});

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

// ---------------------------------------------------------------------------
// POST /api/auth/request-link
// ---------------------------------------------------------------------------
authRoutes.post('/request-link', async (c) => {
  const env = loadEnv();
  const body = await c.req.json().catch(() => null);
  const parsed = RequestLinkBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  }
  const { email, next } = parsed.data;

  // Throttle: if we sent a link to this email in the last 60 seconds and it
  // hasn't been consumed, skip and pretend success. This prevents accidental
  // double-clicks from spamming the inbox without leaking whether the email
  // exists in our system.
  const since = new Date(Date.now() - 60_000);
  const [recent] = await db
    .select({ id: magicLinks.id })
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.email, email),
        gt(magicLinks.createdAt, since),
        isNull(magicLinks.consumedAt),
      ),
    )
    .limit(1);

  if (recent) {
    return c.json({ ok: true, throttled: true });
  }

  const { raw, hash } = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);
  await db.insert(magicLinks).values({ email, tokenHash: hash, expiresAt });

  // Build the verify URL. `next` defaults to the first allowed frontend origin.
  const allowedNext = next && env.FRONTEND_ORIGIN.includes(originOf(next)) ? next : env.FRONTEND_ORIGIN[0];
  const verifyUrl = new URL('/api/auth/verify', publicBaseUrl(c));
  verifyUrl.searchParams.set('token', raw);
  if (allowedNext) verifyUrl.searchParams.set('next', allowedNext);

  await sendMagicLinkEmail(env, {
    to: email,
    magicLinkUrl: verifyUrl.toString(),
    expiresInMinutes: MAGIC_LINK_TTL_MINUTES,
  });

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/auth/verify
// ---------------------------------------------------------------------------
authRoutes.get('/verify', async (c) => {
  const env = loadEnv();
  const token = c.req.query('token');
  const next = c.req.query('next');
  if (!token) return c.json({ error: 'missing_token' }, 400);

  const hash = sha256(token);
  const [link] = await db.select().from(magicLinks).where(eq(magicLinks.tokenHash, hash)).limit(1);
  if (!link) return c.json({ error: 'invalid_token' }, 400);
  if (link.consumedAt) return c.json({ error: 'token_already_used' }, 400);
  if (link.expiresAt.getTime() < Date.now()) return c.json({ error: 'token_expired' }, 400);

  // Mark consumed.
  await db.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, link.id));

  // Find or create the user.
  let [user] = await db.select().from(users).where(eq(users.email, link.email)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({ email: link.email }).returning();
  } else {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  }
  if (!user) return c.json({ error: 'user_create_failed' }, 500);

  const jwt = await signSession({ id: user.id, email: user.email });

  // Redirect to the frontend with the session token in the URL fragment,
  // so it doesn't appear in server logs / referers. Frontend reads it from
  // window.location.hash and immediately strips it via history.replaceState.
  const target = next && env.FRONTEND_ORIGIN.includes(originOf(next)) ? next : env.FRONTEND_ORIGIN[0];
  if (!target) {
    // No configured frontend; return JSON instead so a curl-tester can use it.
    return c.json({ ok: true, session: jwt, user: { id: user.id, email: user.email } });
  }
  const url = new URL(target);
  url.hash = `session=${encodeURIComponent(jwt)}`;
  return c.redirect(url.toString(), 302);
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
authRoutes.get('/me', requireAuth, (c) => {
  const env = loadEnv();
  const user = c.get('user');
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    isAdmin: isAdminEmail(env, user.email),
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
authRoutes.post('/logout', (c) => {
  // JWT is stateless; client just discards its copy. We respond 200 so the
  // frontend can chain a redirect cleanly.
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * Best-effort detection of the public URL the API is reachable at, used when
 * building the magic-link target. Behind Render this comes from the
 * X-Forwarded-* headers.
 */
function publicBaseUrl(c: import('hono').Context): string {
  const proto = c.req.header('X-Forwarded-Proto') ?? 'http';
  const host = c.req.header('X-Forwarded-Host') ?? c.req.header('Host');
  if (host) return `${proto}://${host}`;
  // Fallback to whatever Hono saw on the request.
  return new URL(c.req.url).origin;
}
