/**
 * Cross-year stats — the "Nerd Stats" page.
 *
 * Pulls all entries + results across every year that has a bracket configured
 * AND a recorded championship game (= the year is finished). Computes scores
 * per (entry, year) and aggregates two views:
 *
 *   topScores  — top 10 highest individual entry scores ever
 *   players    — per display-name: years played, low/high (with year), average
 *
 * Display name is the grouping key (lowercased + trimmed). Past entries
 * imported by admin all share the admin's email, so user_id isn't a useful
 * "player" identity. Display name is.
 *
 * Mid-tournament partial scores are intentionally excluded — they'd unfairly
 * drag down per-player averages and pollute the all-time top list.
 */

import { Hono } from 'hono';
import { teamsForYear } from '../config/teams.js';
import { db } from '../db/client.js';
import { entries, results } from '../db/schema.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { computeStandings, winnerMapFromResults } from '../lib/scoring.js';

export const statsRoutes = new Hono<{ Variables: AuthVariables }>();
statsRoutes.use('*', requireAuth);

interface ScoredEntry {
  entryId: string;
  displayName: string;
  year: number;
  score: number;
}

export interface TopScoreRow {
  year: number;
  displayName: string;
  score: number;
  entryId: string;
}

export interface PlayerStatsRow {
  displayName: string;
  yearsPlayed: number;
  yearsList: number[];
  totalEntries: number;
  lowestScore: number;
  lowestYear: number;
  highestScore: number;
  highestYear: number;
  averageScore: number;
}

statsRoutes.get('/', async (c) => {
  const [allEntries, allResults] = await Promise.all([
    db.select().from(entries),
    db.select().from(results),
  ]);

  // Group by year.
  const entriesByYear = new Map<number, typeof allEntries>();
  const resultsByYear = new Map<number, typeof allResults>();
  for (const e of allEntries) {
    const list = entriesByYear.get(e.year);
    if (list) list.push(e);
    else entriesByYear.set(e.year, [e]);
  }
  for (const r of allResults) {
    const list = resultsByYear.get(r.year);
    if (list) list.push(r);
    else resultsByYear.set(r.year, [r]);
  }

  // A year is "complete" once the championship game has a winner recorded.
  const completeYears = new Set<number>();
  for (const r of allResults) {
    if (r.gameId === 'championship') completeYears.add(r.year);
  }

  // Compute scores for every (entry, completed year).
  const scored: ScoredEntry[] = [];
  for (const [year, yearEntries] of entriesByYear) {
    if (!completeYears.has(year)) continue;
    try {
      // teamsForYear throws if no bracket is configured — skip cleanly.
      teamsForYear(year);
    } catch {
      continue;
    }
    const yearResults = resultsByYear.get(year) ?? [];
    const winnerMap = winnerMapFromResults(
      yearResults.map((r) => ({ gameId: r.gameId, winnerTeamId: r.winnerTeamId })),
    );
    const standings = computeStandings(
      year,
      yearEntries.map((e) => ({
        entryId: e.id,
        displayName: e.displayName,
        picks: e.picks,
      })),
      winnerMap,
    );
    for (const s of standings) {
      scored.push({ entryId: s.entryId, displayName: s.displayName, year, score: s.total });
    }
  }

  // Top 10 individual scores.
  const topScores: TopScoreRow[] = [...scored]
    .sort((a, b) => b.score - a.score || a.year - b.year)
    .slice(0, 10)
    .map((s) => ({
      year: s.year,
      displayName: s.displayName,
      score: s.score,
      entryId: s.entryId,
    }));

  // Aggregate per display name (case-insensitive).
  const byKey = new Map<string, ScoredEntry[]>();
  for (const s of scored) {
    const key = s.displayName.trim().toLowerCase();
    const list = byKey.get(key);
    if (list) list.push(s);
    else byKey.set(key, [s]);
  }

  const players: PlayerStatsRow[] = [];
  for (const list of byKey.values()) {
    if (list.length === 0) continue;
    // Use the first entry's casing as the canonical display name.
    const display = list[0]!.displayName;
    const years = new Set(list.map((e) => e.year));
    let lowest = list[0]!;
    let highest = list[0]!;
    let sum = 0;
    for (const e of list) {
      if (e.score < lowest.score) lowest = e;
      if (e.score > highest.score) highest = e;
      sum += e.score;
    }
    players.push({
      displayName: display,
      yearsPlayed: years.size,
      yearsList: Array.from(years).sort((a, b) => a - b),
      totalEntries: list.length,
      lowestScore: lowest.score,
      lowestYear: lowest.year,
      highestScore: highest.score,
      highestYear: highest.year,
      averageScore: Math.round((sum / list.length) * 10) / 10,
    });
  }
  players.sort(
    (a, b) =>
      b.yearsPlayed - a.yearsPlayed ||
      b.averageScore - a.averageScore ||
      a.displayName.localeCompare(b.displayName),
  );

  return c.json({
    completeYears: Array.from(completeYears).sort((a, b) => a - b),
    totalEntries: scored.length,
    topScores,
    players,
  });
});
