/**
 * Postgres connection pool, shared across the app.
 *
 * Using `postgres` (postgres-js) rather than node-postgres for simpler API
 * and tagged-template SQL when needed. Drizzle wraps it for typed queries.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadEnv } from '../lib/env.js';
import * as schema from './schema.js';

const env = loadEnv();

// SSL is opt-in via the connection string. Local Postgres (Docker, dev) and
// internal Postgres on the same private network don't speak SSL by default,
// so don't blanket-enable it for "production" — that breaks self-hosted
// setups. Set ?sslmode=require in DATABASE_URL when you actually need it
// (e.g. managed Postgres providers like Render or Supabase).
const needsSsl =
  env.DATABASE_URL.includes('sslmode=require') ||
  env.DATABASE_URL.includes('render.com');

export const sql = postgres(env.DATABASE_URL, {
  ssl: needsSsl ? 'require' : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });

export type DB = typeof db;
