/**
 * Database schema for HP March Madness.
 *
 * Design notes worth keeping in mind:
 *
 * - One `user` per email. A user can submit many `entries` (we observed people
 *   submitting on behalf of family members in past pools — e.g. one email
 *   covering two siblings' brackets), so there is no unique (user_id, year)
 *   constraint. The submitter "owns" any entries they create.
 *
 * - `entries.picks` is stored as a jsonb array of team IDs. We validate at the
 *   application layer (15 picks, distributed correctly across seed buckets).
 *   Team IDs themselves live in a code-side config (server/src/config/teams.ts)
 *   that gets refreshed yearly when the tournament field is set.
 *
 * - `results.game_id` follows the pattern `R{round}-S{slot}`, e.g. `R1-S01`
 *   for the first first-round game, `R6-S01` for the championship. This makes
 *   the bracket tree deterministic and human-readable.
 *
 * - Tiebreakers are computed at read time, not stored. Tied entries are broken
 *   by per-round score (R1 first, then R2, ...) — see scoring.ts.
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// users — one per unique email
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => ({
    emailUnique: uniqueIndex('users_email_unique').on(t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// magic_links — one-time tokens emailed to users for sign-in
// ---------------------------------------------------------------------------
export const magicLinks = pgTable(
  'magic_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    // SHA-256 hex of the raw token. We never store the raw value.
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenHashIdx: uniqueIndex('magic_links_token_hash_unique').on(t.tokenHash),
    emailExpiresIdx: index('magic_links_email_expires_idx').on(t.email, t.expiresAt),
  }),
);

export type MagicLink = typeof magicLinks.$inferSelect;
export type NewMagicLink = typeof magicLinks.$inferInsert;

// ---------------------------------------------------------------------------
// entries — submitted brackets
// ---------------------------------------------------------------------------
export const PAYMENT_METHODS = ['venmo', 'paypal', 'check', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    displayName: text('display_name').notNull(),
    // Array of team IDs (matches IDs in server/src/config/teams.ts for `year`).
    // Validated app-side: must be exactly 15, distributed across seed buckets.
    picks: jsonb('picks').$type<string[]>().notNull(),

    // Payment tracking
    paymentMethod: text('payment_method').$type<PaymentMethod>().notNull(),
    paymentMethodNote: text('payment_method_note'),
    paymentReceived: boolean('payment_received').notNull().default(false),
    paymentReceivedAt: timestamp('payment_received_at', { withTimezone: true }),
    paymentNotes: text('payment_notes'),

    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    yearIdx: index('entries_year_idx').on(t.year),
    userYearIdx: index('entries_user_year_idx').on(t.userId, t.year),
  }),
);

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

// ---------------------------------------------------------------------------
// results — game winners, entered by admin
// ---------------------------------------------------------------------------
export const results = pgTable(
  'results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    year: integer('year').notNull(),
    // Format: R{round}-S{slot} — e.g. R1-S01 for first game of round 1,
    // R6-S01 for the championship.
    gameId: text('game_id').notNull(),
    winnerTeamId: text('winner_team_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    yearGameUnique: uniqueIndex('results_year_game_unique').on(t.year, t.gameId),
  }),
);

export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;

// ---------------------------------------------------------------------------
// app_settings — small key/value store, scoped per year
// ---------------------------------------------------------------------------
// Common keys we use:
//   submissions_closed: boolean
//   current_round:      number (optional, just for display hints)
//
// Anything else that needs to be admin-toggleable can land here without a
// schema migration.
export const appSettings = pgTable(
  'app_settings',
  {
    year: integer('year').notNull(),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.year, t.key] }),
  }),
);

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
