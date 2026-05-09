/**
 * Client-side mirror of server pick validation.
 *
 * Used for live UI feedback as the user toggles teams. The server is still
 * authoritative — we re-validate on submit.
 */

import type { SeedBucket } from './config';
import type { Team } from './types';

export interface BucketCount {
  bucketId: string;
  required: number;
  current: number;
  full: boolean;
  over: boolean;
}

/** Compute per-bucket pick counts. */
export function computeBucketCounts(
  picks: ReadonlySet<string>,
  teamMap: ReadonlyMap<string, Team>,
  buckets: readonly SeedBucket[],
): BucketCount[] {
  return buckets.map((bucket) => {
    let count = 0;
    for (const id of picks) {
      const team = teamMap.get(id);
      if (team && bucket.seeds.includes(team.seed)) count += 1;
    }
    return {
      bucketId: bucket.id,
      required: bucket.pickCount,
      current: count,
      full: count >= bucket.pickCount,
      over: count > bucket.pickCount,
    };
  });
}

/** Returns the bucket a given seed belongs to. Used to gate clicks. */
export function bucketForSeed(seed: number, buckets: readonly SeedBucket[]): SeedBucket | undefined {
  return buckets.find((b) => b.seeds.includes(seed));
}

/**
 * Decide whether a team can be toggled ON given current selections.
 * If the team is already selected, it's always toggle-able (off).
 * If selecting it would push that bucket over its limit, refuse.
 */
export function canSelectTeam(
  team: Team,
  picks: ReadonlySet<string>,
  bucketCounts: readonly BucketCount[],
  buckets: readonly SeedBucket[],
): boolean {
  if (picks.has(team.id)) return true;
  const bucket = bucketForSeed(team.seed, buckets);
  if (!bucket) return false;
  const count = bucketCounts.find((c) => c.bucketId === bucket.id);
  if (!count) return false;
  return !count.full;
}

/** True if every bucket is exactly full (i.e. the entry is submittable). */
export function allBucketsSatisfied(counts: readonly BucketCount[]): boolean {
  return counts.every((c) => c.current === c.required);
}
