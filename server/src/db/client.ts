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

// Render's internal Postgres URL doesn't require SSL on the same network,
// but external/managed Postgres usually does. We enable SSL when the URL
// looks external (contains "render.com" or explicit ?sslmode=require).
const needsSsl =
  env.DATABASE_URL.includes('sslmode=require') ||
  env.DATABASE_URL.includes('render.com') ||
  env.NODE_ENV === 'production';

export const sql = postgres(env.DATABASE_URL, {
  ssl: needsSsl ? 'require' : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });

export type DB = typeof db;
