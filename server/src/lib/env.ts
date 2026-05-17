/**
 * Environment configuration.
 *
 * Validated once at startup so the rest of the app can rely on these being
 * present and well-typed. If anything is missing or malformed we crash the
 * process loudly — better to fail at boot than midway through serving traffic.
 */

import { z } from 'zod';

const csv = (s: string) =>
  s
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  ADMIN_EMAILS: z
    .string()
    .min(1)
    .transform((s) => csv(s).map((e) => e.toLowerCase())),
  FRONTEND_ORIGIN: z
    .string()
    .min(1)
    .transform((s) => csv(s)),
  PORT: z
    .string()
    .default('8080')
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.number().int().positive()),
  TOURNAMENT_YEAR: z
    .string()
    .default('2026')
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.number().int().min(2000).max(2100)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Environment validation failed; refusing to start.');
  }
  cached = parsed.data;
  return cached;
}

export function isAdminEmail(env: Env, email: string): boolean {
  return env.ADMIN_EMAILS.includes(email.toLowerCase());
}
