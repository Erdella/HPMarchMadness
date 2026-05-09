/**
 * Scoring + leaderboard math.
 *
 * Pure functions, no DB access. They take entries + results as plain data and
 * return computed standings. The HTTP layer (routes/leaderboard.ts) is the
 * one that loads from the DB and feeds these functions.
 *
 * Tiebreaker rule (from Brett's email):
 *   "1st, 2nd, and 3rd Place will be determined by the total points
 *    accumulated throughout the tournament. Tie breakers will be based on
 *    1st Round Points. If a tie still remains, we will move to the next
 *    round until a winner is determined."
 *
 * → Sort key per entry: [totalScore, R1, R2, R3, R4, R5, R6] (all DESC).
 */

import { POINTS_BY_ROUND_INDEX, buildGames, type Game } from '../config/teams.js';

/** Snapshot of which team won each game, keyed by gameId. */
export type WinnerMap = Readonly<Record<string, string>>;

/** Per-entry score, broken out by round so we can tiebreak. */
export interface EntryScore {
  total: number;
  /** byRound[i] = points earned from round i (0..5). */
  byRound: readonly number[];
}

/**
 * Compute the score for a single entry.
 *
 * For each picked team, walk through every game in the bracket. If the picked
 * team won that game, the entry earns the round's points. We don't need to
 * know the winners of intermediate rounds for the picked team — the results
 * map tells us directly which team is in winnerMap[gameId].
 */
export function scoreEntry(
  year: number,
  picks: readonly string[],
  winnerMap: WinnerMap,
): EntryScore {
  const games = buildGames(year);
  const byRound = [0, 0, 0, 0, 0, 0];
  const pickedSet = new Set(picks);

  for (const game of games) {
    const winner = winnerMap[game.id];
    if (!winner) continue;
    if (pickedSet.has(winner)) {
      const pts = POINTS_BY_ROUND_INDEX[game.round] ?? 0;
      byRound[game.round] += pts;
    }
  }

  const total = byRound.reduce((a, b) => a + b, 0);
  return { total, byRound };
}

/**
 * Standings row returned to the client.
 */
export interface StandingsRow {
  entryId: string;
  displayName: string;
  total: number;
  byRound: readonly number[];
  /** 1-based rank with shared rank for genuine ties (after applying the
   *  per-round tiebreaker — so genuine ties are very rare in practice). */
  rank: number;
}

export interface ScoreInput {
  entryId: string;
  displayName: string;
  picks: readonly string[];
}

export function computeStandings(
  year: number,
  entries: readonly ScoreInput[],
  winnerMap: WinnerMap,
): StandingsRow[] {
  const scored = entries.map((e) => {
    const score = scoreEntry(year, e.picks, winnerMap);
    return {
      entryId: e.entryId,
      displayName: e.displayName,
      total: score.total,
      byRound: score.byRound,
    };
  });

  // Sort by [total, byRound[0], byRound[1], ..., byRound[5]] all descending.
  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    for (let i = 0; i < a.byRound.length; i += 1) {
      const diff = (b.byRound[i] ?? 0) - (a.byRound[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  // Assign ranks. Two entries share a rank only if every tiebreaker also ties.
  const rows: StandingsRow[] = [];
  let lastKey = '';
  let lastRank = 0;
  scored.forEach((s, i) => {
    const key = `${s.total}|${s.byRound.join(',')}`;
    const rank = key === lastKey ? lastRank : i + 1;
    lastKey = key;
    lastRank = rank;
    rows.push({ ...s, rank });
  });

  return rows;
}

/**
 * Build a winnerMap from a list of `results` rows for a given year.
 */
export function winnerMapFromResults(
  results: readonly { gameId: string; winnerTeamId: string }[],
): WinnerMap {
  const m: Record<string, string> = {};
  for (const r of results) m[r.gameId] = r.winnerTeamId;
  return m;
}

/**
 * For sanity-checking results entries: returns the IDs of games that don't
 * exist in this year's bracket. Useful to reject typo'd game IDs in admin
 * routes.
 */
export function unknownGameIds(year: number, gameIds: readonly string[]): string[] {
  const valid = new Set(buildGames(year).map((g) => g.id));
  return gameIds.filter((id) => !valid.has(id));
}

/** Convenience for routes that just want a Set. */
export function validGameIdSet(year: number): Set<string> {
  return new Set(buildGames(year).map((g) => g.id));
}

/** Ergonomic re-export so consumers don't need to know about Game shape. */
export type { Game };
