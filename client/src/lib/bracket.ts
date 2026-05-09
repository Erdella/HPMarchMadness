/**
 * Bracket helpers — used by the admin Results screen to figure out which
 * team is eligible to win a given downstream game given the winners entered
 * upstream.
 *
 * Mirrors the original index.html's `getGameOptions`.
 */

import type { Game, Team } from './types';

/**
 * Given a game, the current winners map, and the team lookup, return the
 * set of teams that could legally win this game.
 *
 *   - First-round game: the two participants.
 *   - Downstream game: the winners of the two upstream games, IF both are set.
 *     If either upstream is missing, returns null (caller should show
 *     "awaiting upstream").
 */
export function gameOptions(
  game: Game,
  winners: Readonly<Record<string, string>>,
  teamMap: ReadonlyMap<string, Team>,
): Team[] | null {
  if (game.round === 0) {
    return game.participants
      .map((id) => teamMap.get(id))
      .filter((t): t is Team => Boolean(t));
  }

  const a = winners[game.from[0]];
  const b = winners[game.from[1]];
  if (!a || !b) return null;

  const teamA = teamMap.get(a);
  const teamB = teamMap.get(b);
  return [teamA, teamB].filter((t): t is Team => Boolean(t));
}

/** Group games by round (0..5) for rendering. */
export function gamesByRound(games: readonly Game[]): Game[][] {
  const out: Game[][] = [[], [], [], [], [], []];
  for (const g of games) out[g.round]?.push(g);
  return out;
}
