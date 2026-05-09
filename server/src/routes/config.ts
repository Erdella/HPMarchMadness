/**
 * Public read-only config endpoints.
 *
 * GET /api/config           → pool rules, copy, scoring, bucket rules, fees
 * GET /api/config/teams     → 64-team field for the current year
 * GET /api/config/games     → 63-game bracket tree for the current year
 *
 * Frontend hits these on load to render the draft UI without hardcoding any
 * tournament data into the React bundle. New season → update teams.ts +
 * pool.ts on the server, no client redeploy needed.
 */

import { Hono } from 'hono';
import {
  ABOUT_HENRY,
  ANNUAL_NUMBER,
  DONATION_PER_ENTRY_CENTS,
  DONATION_RECIPIENT,
  ENTRY_FEE_CENTS,
  HOW_TO_PLAY,
  MEMORIAL_FOOTER,
  PAYMENT_OPTIONS,
  POOL_NAME,
  POOL_TAGLINE,
  ROUND_LABELS,
  SCORING_BY_ROUND,
  SEED_BUCKETS,
  TOTAL_PICKS_REQUIRED,
} from '../config/pool.js';
import { buildGames, teamsForYear } from '../config/teams.js';
import { loadEnv } from '../lib/env.js';

export const configRoutes = new Hono();

configRoutes.get('/', (c) => {
  const env = loadEnv();
  return c.json({
    poolName: POOL_NAME,
    tagline: POOL_TAGLINE,
    annualNumber: ANNUAL_NUMBER,
    year: env.TOURNAMENT_YEAR,
    scoring: SCORING_BY_ROUND,
    roundLabels: ROUND_LABELS,
    seedBuckets: SEED_BUCKETS,
    totalPicksRequired: TOTAL_PICKS_REQUIRED,
    fee: {
      entryCents: ENTRY_FEE_CENTS,
      donationPerEntryCents: DONATION_PER_ENTRY_CENTS,
    },
    donationRecipient: DONATION_RECIPIENT,
    paymentOptions: PAYMENT_OPTIONS,
    aboutHenry: ABOUT_HENRY,
    howToPlay: HOW_TO_PLAY,
    memorialFooter: MEMORIAL_FOOTER,
  });
});

configRoutes.get('/teams', (c) => {
  const env = loadEnv();
  return c.json({ year: env.TOURNAMENT_YEAR, teams: teamsForYear(env.TOURNAMENT_YEAR) });
});

configRoutes.get('/games', (c) => {
  const env = loadEnv();
  return c.json({ year: env.TOURNAMENT_YEAR, games: buildGames(env.TOURNAMENT_YEAR) });
});
