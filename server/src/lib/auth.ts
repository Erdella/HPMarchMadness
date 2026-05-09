/**
 * Auth primitives.
 *
 * Magic-link flow:
 *   1. POST /api/auth/request-link  → server creates a magic_links row with a
 *      hashed token, emails the raw token to the user.
 *   2. GET  /api/auth/verify?token  → server hashes, looks up, marks consumed,
 *      finds-or-creates the user, signs a JWT, redirects to the frontend with
 *      the JWT in the URL fragment.
 *   3. Frontend stores the JWT (localStorage), strips it from the URL, sends
 *      it as `Authorization: Bearer <jwt>` on all subsequent calls.
 *   4. requireAuth() middleware reads the header, verifies the JWT, looks the
 *      user up, attaches { user, isAdmin } to the Hono context.
 *
 * Why JWT-in-localStorage instead of cookies?
 *   The frontend (GitHub Pages) and API (Render) are on different origins, so
 *   third-party cookies are flaky across browsers. Bearer tokens dodge that
 *   entirely. Tradeoff: tokens can't be HttpOnly. The session secret rotates
 *   any leaked token immediately and the leaderboard isn't a high-value
 *   target, so this is a reasonable trade for this app.
 */

import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import type { User } from '../db/schema.js';
import { isAdminEmail, loadEnv } from './env.js';

const SESSION_TTL_DAYS = 30;
const MAGIC_LINK_TTL_MINUTES = 15;

// ---------------------------------------------------------------------------
// Token generation + hashing
// ---------------------------------------------------------------------------

/**
 * Generate a magic-link token. We return both the raw value (sent in email)
 * and the SHA-256 hex hash (stored in DB). We never persist the raw token.
 */
export function generateMagicLinkToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  const hash = sha256(raw);
  return { raw, hash };
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const MAGIC_LINK_EXPIRY_MS = MAGIC_LINK_TTL_MINUTES * 60 * 1000;
export { MAGIC_LINK_TTL_MINUTES };

// ---------------------------------------------------------------------------
// Session JWTs
// ---------------------------------------------------------------------------

interface SessionPayload {
  sub: string; // user id
  email: string;
}

function getSecretKey(): Uint8Array {
  const env = loadEnv();
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function signSession(user: Pick<User, 'id' | 'email'>): Promise<string> {
  const secret = getSecretKey();
  return await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hono middleware
// ---------------------------------------------------------------------------

export interface AuthVariables {
  user: User;
  isAdmin: boolean;
}

/**
 * Reads `Authorization: Bearer <jwt>` (or `?session=` query param as a fallback,
 * useful for the magic-link landing flow). On success, attaches `user` and
 * `isAdmin` to ctx.var. On failure, returns 401.
 */
export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const token = readToken(c);
  if (!token) return c.json({ error: 'unauthenticated' }, 401);

  const payload = await verifySession(token);
  if (!payload) return c.json({ error: 'invalid_or_expired_session' }, 401);

  const env = loadEnv();
  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user) return c.json({ error: 'user_not_found' }, 401);

  c.set('user', user);
  c.set('isAdmin', isAdminEmail(env, user.email));
  await next();
};

/**
 * Like requireAuth, but additionally requires the user's email to be in
 * ADMIN_EMAILS. Use on admin routes (results entry, lock submissions, etc).
 */
export const requireAdmin: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  // Run requireAuth first.
  await requireAuth(c, async () => {
    if (!c.get('isAdmin')) {
      return c.json({ error: 'forbidden' }, 403);
    }
    await next();
  });
};

function readToken(c: Context): string | null {
  const header = c.req.header('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  // Optional query-param fallback — only useful for the verify-link redirect.
  const q = c.req.query('session');
  return q && q.length > 0 ? q : null;
}
