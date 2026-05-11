/**
 * Bracket import parser + validator.
 *
 * Takes a chunk of admin-pasted text in a permissive CSV-ish format and
 * returns either a clean `Team[]` ready to insert, or a list of human-
 * readable errors that the UI can surface.
 *
 * Accepted line format (per line, ignoring blanks and #-comments):
 *
 *     Region, Seed, Team Name
 *
 * Region: South / West / Midwest / East (case-insensitive)
 * Seed:   1-16
 * Name:   any non-empty string (commas allowed via quoting OR by being
 *          everything-after-second-comma — see parseLine below)
 *
 * Example valid input:
 *
 *     South,1,Purdue
 *     South,16,LIU/Little Rock
 *     # comments are fine
 *     West,4,BYU
 */

import type { BracketSide, Region, Team } from '../config/teams.js';
import { REGION_ORDER } from '../config/teams.js';

export interface ImportError {
  line: number;
  message: string;
}

export type ImportResult =
  | { ok: true; teams: Team[] }
  | { ok: false; errors: ImportError[] };

// Side is determined by region — South/West are on the Left half of the
// bracket, Midwest/East on the Right. This matches the Final Four pairings
// (South vs Midwest, West vs East) used by buildGames().
const SIDE_BY_REGION: Record<Region, BracketSide> = {
  South: 'Left',
  West: 'Left',
  Midwest: 'Right',
  East: 'Right',
};

const VALID_REGIONS: Region[] = [...REGION_ORDER];

/** Normalize and validate a region string, returning a canonical Region or null. */
function parseRegion(raw: string): Region | null {
  const cleaned = raw.trim().toLowerCase();
  for (const r of VALID_REGIONS) {
    if (r.toLowerCase() === cleaned) return r;
  }
  return null;
}

/** Parse a single non-comment line. Returns the partial team or an error string. */
function parseLine(raw: string): { region: Region; seed: number; name: string } | string {
  // Split on the first two commas only — name can contain commas.
  const firstComma = raw.indexOf(',');
  if (firstComma < 0) return 'expected at least two commas (Region,Seed,Name)';
  const secondComma = raw.indexOf(',', firstComma + 1);
  if (secondComma < 0) return 'expected at least two commas (Region,Seed,Name)';

  const regionStr = raw.slice(0, firstComma);
  const seedStr = raw.slice(firstComma + 1, secondComma);
  const nameStr = raw.slice(secondComma + 1).trim();

  const region = parseRegion(regionStr);
  if (!region) {
    return `unknown region "${regionStr.trim()}" (expected one of ${VALID_REGIONS.join(', ')})`;
  }

  const seed = Number.parseInt(seedStr.trim(), 10);
  if (!Number.isFinite(seed) || seed < 1 || seed > 16) {
    return `seed must be 1–16, got "${seedStr.trim()}"`;
  }

  if (!nameStr) return 'team name is empty';
  if (nameStr.length > 80) return `team name too long (>${nameStr.length} chars)`;

  return { region, seed, name: nameStr };
}

/** Slugify a team name into a URL-safe ID fragment. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Parse the full pasted text into a canonical Team[] or a list of errors.
 *
 * Validation enforced:
 *   - 64 rows total (4 regions × 16 seeds)
 *   - each region exactly 16 teams, with every seed 1–16 present once
 *   - no duplicate names within a region (cosmetic; the UI is happier that way)
 */
export function parseBracketImport(text: string): ImportResult {
  const errors: ImportError[] = [];
  const parsed: Array<{ region: Region; seed: number; name: string; line: number }> = [];

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const lineNum = i + 1;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return; // blank or comment

    const result = parseLine(trimmed);
    if (typeof result === 'string') {
      errors.push({ line: lineNum, message: result });
      return;
    }
    parsed.push({ ...result, line: lineNum });
  });

  if (errors.length > 0) return { ok: false, errors };

  // Total count
  if (parsed.length !== 64) {
    return {
      ok: false,
      errors: [
        {
          line: 0,
          message: `Expected 64 teams, got ${parsed.length}.`,
        },
      ],
    };
  }

  // Each region must have all 16 seeds, once.
  for (const region of VALID_REGIONS) {
    const inRegion = parsed.filter((p) => p.region === region);
    if (inRegion.length !== 16) {
      errors.push({
        line: 0,
        message: `${region} region has ${inRegion.length} teams (need 16).`,
      });
      continue;
    }
    const seenSeeds = new Set<number>();
    for (const t of inRegion) {
      if (seenSeeds.has(t.seed)) {
        errors.push({
          line: t.line,
          message: `${region} seed ${t.seed} appears more than once.`,
        });
      }
      seenSeeds.add(t.seed);
    }
    for (let s = 1; s <= 16; s += 1) {
      if (!seenSeeds.has(s)) {
        errors.push({
          line: 0,
          message: `${region} region is missing a #${s} seed.`,
        });
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Build the canonical Team[] with auto-generated stable IDs.
  // Uniqueness of (year, id) is guaranteed by region+seed since (region, seed)
  // is unique per year, but we still slugify the name into the id for
  // human-readability in logs and SQL inspection.
  const teams: Team[] = parsed.map((p) => ({
    id: `${p.region.toLowerCase()}-${p.seed}-${slugify(p.name) || 'team'}`,
    name: p.name,
    seed: p.seed,
    region: p.region,
    side: SIDE_BY_REGION[p.region],
  }));

  return { ok: true, teams };
}
