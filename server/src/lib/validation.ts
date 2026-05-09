/**
 * Pick validation.
 *
 * Given a year and a list of team IDs, decide whether the picks form a legal
 * 15-team entry per the bucket rules. Used by POST /api/entries before the
 * entry is allowed to land in the database.
 *
 * The function is intentionally pure so the same logic can be reused on the
 * client (Vite imports it from a shared package later, or the client mirrors
 * it). For now the client will request /api/config to get bucket rules and
 * compute its own preview, with the server as the authoritative gate.
 */

import { SEED_BUCKETS, TOTAL_PICKS_REQUIRED, type SeedBucket } from '../config/pool.js';
import { teamMapForYear } from '../config/teams.js';

export interface ValidationOk {
  ok: true;
}

export interface ValidationFail {
  ok: false;
  /** Stable machine-readable code, useful for the client to map to UX. */
  code:
    | 'wrong_pick_count'
    | 'duplicate_picks'
    | 'unknown_team'
    | 'bucket_count_mismatch'
    | 'team_seed_outside_bucket';
  message: string;
  /** Per-bucket counts — present when relevant for surfacing in the UI. */
  bucketCounts?: Record<string, number>;
}

export type ValidationResult = ValidationOk | ValidationFail;

export function validatePicks(year: number, picks: readonly string[]): ValidationResult {
  // Length check
  if (picks.length !== TOTAL_PICKS_REQUIRED) {
    return {
      ok: false,
      code: 'wrong_pick_count',
      message: `Need exactly ${TOTAL_PICKS_REQUIRED} picks, got ${picks.length}.`,
    };
  }

  // Duplicate check
  const seen = new Set<string>();
  for (const id of picks) {
    if (seen.has(id)) {
      return {
        ok: false,
        code: 'duplicate_picks',
        message: `Duplicate team in picks: ${id}.`,
      };
    }
    seen.add(id);
  }

  // Resolve each pick to a team. Unknown team IDs reject.
  const teamMap = teamMapForYear(year);
  const resolved = picks.map((id) => ({ id, team: teamMap.get(id) }));
  for (const r of resolved) {
    if (!r.team) {
      return {
        ok: false,
        code: 'unknown_team',
        message: `Team not in this year's bracket: ${r.id}.`,
      };
    }
  }

  // Per-bucket count check.
  const bucketCounts: Record<string, number> = {};
  for (const b of SEED_BUCKETS) bucketCounts[b.id] = 0;

  for (const r of resolved) {
    const seed = r.team!.seed;
    const bucket = bucketForSeed(seed);
    if (!bucket) {
      return {
        ok: false,
        code: 'team_seed_outside_bucket',
        message: `Team ${r.team!.name} has seed ${seed} which is outside any bucket — bracket data is malformed.`,
      };
    }
    bucketCounts[bucket.id] = (bucketCounts[bucket.id] ?? 0) + 1;
  }

  for (const b of SEED_BUCKETS) {
    if (bucketCounts[b.id] !== b.pickCount) {
      return {
        ok: false,
        code: 'bucket_count_mismatch',
        message: `Need ${b.pickCount} picks from ${b.label}, got ${bucketCounts[b.id] ?? 0}.`,
        bucketCounts,
      };
    }
  }

  return { ok: true };
}

function bucketForSeed(seed: number): SeedBucket | undefined {
  return SEED_BUCKETS.find((b) => b.seeds.includes(seed));
}
