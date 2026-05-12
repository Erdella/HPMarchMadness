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
import { db } from '../db/client.js';
import { entries, results, teams as teamsTable } from '../db/schema.js';
import { loadEnv } from '../lib/env.js';
import { readYear } from '../lib/year.js';

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
  const y = readYear(c);
  if (!y.ok) return y.response;
  try {
    return c.json({ year: y.year, teams: teamsForYear(y.year) });
  } catch {
    return c.json({ year: y.year, teams: [] });
  }
});

configRoutes.get('/games', (c) => {
  const y = readYear(c);
  if (!y.ok) return y.response;
  try {
    return c.json({ year: y.year, games: buildGames(y.year) });
  } catch {
    return c.json({ year: y.year, games: [] });
  }
});

/**
 * GET /api/config/years — list every year we have any data for.
 *
 * Returns a sorted list along with which kinds of data exist per year
 * (teams / entries / results). The frontend uses this to populate the
 * header year-selector dropdown.
 */
configRoutes.get('/years', async (c) => {
  const env = loadEnv();
  const [teamYears, entryYears, resultYears] = await Promise.all([
    db.selectDistinct({ year: teamsTable.year }).from(teamsTable),
    db.selectDistinct({ year: entries.year }).from(entries),
    db.selectDistinct({ year: results.year }).from(results),
  ]);

  const all = new Set<number>([env.TOURNAMENT_YEAR]);
  for (const r of teamYears) all.add(r.year);
  for (const r of entryYears) all.add(r.year);
  for (const r of resultYears) all.add(r.year);

  const teamSet = new Set(teamYears.map((r) => r.year));
  const entrySet = new Set(entryYears.map((r) => r.year));
  const resultSet = new Set(resultYears.map((r) => r.year));

  const years = Array.from(all)
    .sort((a, b) => b - a)
    .map((year) => ({
      year,
      hasTeams: teamSet.has(year) || canFallbackTeams(year),
      hasEntries: entrySet.has(year),
      hasResults: resultSet.has(year),
      isCurrent: year === env.TOURNAMENT_YEAR,
    }));

  return c.json({ currentYear: env.TOURNAMENT_YEAR, years });
});

/** True if there's a code-side fallback for this year even with no DB rows. */
function canFallbackTeams(year: number): boolean {
  try {
    teamsForYear(year);
    return true;
  } catch {
    return false;
  }
}
