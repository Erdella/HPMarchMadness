/**
 * Year resolution helper.
 *
 * Routes accept an optional `?year=` query param. When omitted, fall back to
 * the configured TOURNAMENT_YEAR. The point of this helper is to centralize
 * validation so a bogus year (`?year=abc`) returns a 400 cleanly rather than
 * NaN-ing through the rest of the request.
 */

import type { Context } from 'hono';
import { loadEnv } from './env.js';

export interface YearOk {
  ok: true;
  year: number;
}

export interface YearError {
  ok: false;
  response: Response;
}

/** Parse + validate `?year=` from the request, with TOURNAMENT_YEAR fallback. */
export function readYear(c: Context): YearOk | YearError {
  const env = loadEnv();
  const raw = c.req.query('year');
  if (raw === undefined || raw === '') {
    return { ok: true, year: env.TOURNAMENT_YEAR };
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
    return {
      ok: false,
      response: c.json({ error: 'invalid_year', got: raw }, 400),
    };
  }
  return { ok: true, year: parsed };
}
