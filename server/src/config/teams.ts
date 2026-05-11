/**
 * Tournament field + bracket structure.
 *
 * IMPORTANT: the 64-team list below is currently the 2025 bracket as it was
 * encoded in the original index.html. It is a structural placeholder. Before
 * going live each year, an admin must replace `TEAMS_2026` (or add the next
 * year's roster) with the actual Selection Sunday bracket for that year.
 *
 * Why keep the bracket in code rather than the database?
 *   - Brackets change once a year, not interactively
 *   - Admin UI for editing 64 teams is a lot of UI to maintain
 *   - A code change forces a deploy → forces a bracket-correct sanity check
 *   - The historical record lives in git, not in a forgotten DB row
 *
 * Game IDs follow the original format `${region}-r${round}-g${slot}`, plus
 * `final-four-1`, `final-four-2`, `championship`. They are stored as TEXT in
 * the `results` table.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Region = 'South' | 'West' | 'Midwest' | 'East';
export type BracketSide = 'Left' | 'Right';

export interface Team {
  id: string;
  name: string;
  seed: number;
  region: Region;
  side: BracketSide;
}

export interface FirstRoundGame {
  id: string;
  round: 0;
  region: Region;
  label: string;
  bracketLabel: string;
  /** Team IDs of the two participants. */
  participants: [string, string];
}

export interface DownstreamGame {
  id: string;
  round: 1 | 2 | 3 | 4 | 5;
  region?: Region;
  label: string;
  bracketLabel: string;
  /** IDs of the two upstream games whose winners face off here. */
  from: [string, string];
}

export type Game = FirstRoundGame | DownstreamGame;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REGION_ORDER: readonly Region[] = ['South', 'West', 'Midwest', 'East'];

/** Round index → human label. (Round 0 = first round.) */
export const ROUND_LABEL_BY_INDEX: readonly string[] = [
  'Round 1',
  'Round 2',
  'Sweet 16',
  'Elite 8',
  'Final Four',
  'Championship',
];

/** Round index 0..5 → points awarded for a team winning that round. */
export const POINTS_BY_ROUND_INDEX: readonly number[] = [1, 2, 4, 6, 8, 12];

/** Standard NCAA first-round seed matchups, in slot order. */
export const FIRST_ROUND_SEED_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

// ---------------------------------------------------------------------------
// 2026 bracket — TODO: replace with actual 2026 Selection Sunday bracket.
// Currently a structural placeholder using 2025 data inherited from the
// original index.html.
// ---------------------------------------------------------------------------

// prettier-ignore
const TEAMS_2026: Team[] = [
  // South region (Left side)
  { id: 'south-1-purdue',          name: 'Purdue',           seed:  1, region: 'South',   side: 'Left' },
  { id: 'south-16-liu',            name: 'LIU/Little Rock',  seed: 16, region: 'South',   side: 'Left' },
  { id: 'south-8-creighton',       name: 'Creighton',        seed:  8, region: 'South',   side: 'Left' },
  { id: 'south-9-iowa',            name: 'Iowa',             seed:  9, region: 'South',   side: 'Left' },
  { id: 'south-5-louisville',      name: 'Louisville',       seed:  5, region: 'South',   side: 'Left' },
  { id: 'south-12-bradley',        name: 'Bradley',          seed: 12, region: 'South',   side: 'Left' },
  { id: 'south-4-ucla',            name: 'UCLA',             seed:  4, region: 'South',   side: 'Left' },
  { id: 'south-13-uncw',           name: 'UNC-Wilmington',   seed: 13, region: 'South',   side: 'Left' },
  { id: 'south-6-arkansas',        name: 'Arkansas',         seed:  6, region: 'South',   side: 'Left' },
  { id: 'south-11-boise-maryland', name: 'Boise / Maryland', seed: 11, region: 'South',   side: 'Left' },
  { id: 'south-3-stjohns',         name: "St. John's",       seed:  3, region: 'South',   side: 'Left' },
  { id: 'south-14-high-point',     name: 'High Point',       seed: 14, region: 'South',   side: 'Left' },
  { id: 'south-7-oregon',          name: 'Oregon',           seed:  7, region: 'South',   side: 'Left' },
  { id: 'south-10-vcu',            name: 'VCU',              seed: 10, region: 'South',   side: 'Left' },
  { id: 'south-2-kentucky',        name: 'Kentucky',         seed:  2, region: 'South',   side: 'Left' },
  { id: 'south-15-iona',           name: 'Iona',             seed: 15, region: 'South',   side: 'Left' },

  // West region (Left side)
  { id: 'west-1-florida',            name: 'Florida',           seed:  1, region: 'West',    side: 'Left' },
  { id: 'west-16-vermont',           name: 'Vermont',           seed: 16, region: 'West',    side: 'Left' },
  { id: 'west-8-wisconsin',          name: 'Wisconsin',         seed:  8, region: 'West',    side: 'Left' },
  { id: 'west-9-north-carolina',     name: 'North Carolina',    seed:  9, region: 'West',    side: 'Left' },
  { id: 'west-5-illinois',           name: 'Illinois',          seed:  5, region: 'West',    side: 'Left' },
  { id: 'west-12-yale',              name: 'Yale',              seed: 12, region: 'West',    side: 'Left' },
  { id: 'west-4-byu',                name: 'BYU',               seed:  4, region: 'West',    side: 'Left' },
  { id: 'west-13-uc-irvine',         name: 'UC-Irvine',         seed: 13, region: 'West',    side: 'Left' },
  { id: 'west-6-auburn',             name: 'Auburn',            seed:  6, region: 'West',    side: 'Left' },
  { id: 'west-11-utah-state-indiana',name: 'Utah St / Indiana', seed: 11, region: 'West',    side: 'Left' },
  { id: 'west-3-gonzaga',            name: 'Gonzaga',           seed:  3, region: 'West',    side: 'Left' },
  { id: 'west-14-utah-valley',       name: 'Utah Valley',       seed: 14, region: 'West',    side: 'Left' },
  { id: 'west-7-missouri',           name: 'Missouri',          seed:  7, region: 'West',    side: 'Left' },
  { id: 'west-10-marquette',         name: 'Marquette',         seed: 10, region: 'West',    side: 'Left' },
  { id: 'west-2-michigan',           name: 'Michigan',          seed:  2, region: 'West',    side: 'Left' },
  { id: 'west-15-northern-colorado', name: 'Northern Colorado', seed: 15, region: 'West',    side: 'Left' },

  // Midwest region (Right side)
  { id: 'midwest-1-houston',           name: 'Houston',            seed:  1, region: 'Midwest', side: 'Right' },
  { id: 'midwest-16-colgate-southern', name: 'Colgate / Southern', seed: 16, region: 'Midwest', side: 'Right' },
  { id: 'midwest-8-texas',             name: 'Texas',              seed:  8, region: 'Midwest', side: 'Right' },
  { id: 'midwest-9-nc-state',          name: 'NC State',           seed:  9, region: 'Midwest', side: 'Right' },
  { id: 'midwest-5-michigan-state',    name: 'Michigan State',     seed:  5, region: 'Midwest', side: 'Right' },
  { id: 'midwest-12-liberty',          name: 'Liberty',            seed: 12, region: 'Midwest', side: 'Right' },
  { id: 'midwest-4-texas-tech',        name: 'Texas Tech',         seed:  4, region: 'Midwest', side: 'Right' },
  { id: 'midwest-13-troy',             name: 'Troy',               seed: 13, region: 'Midwest', side: 'Right' },
  { id: 'midwest-6-baylor',            name: 'Baylor',             seed:  6, region: 'Midwest', side: 'Right' },
  { id: 'midwest-11-memphis',          name: 'Memphis',            seed: 11, region: 'Midwest', side: 'Right' },
  { id: 'midwest-3-alabama',           name: 'Alabama',            seed:  3, region: 'Midwest', side: 'Right' },
  { id: 'midwest-14-mcneese-state',    name: 'McNeese State',      seed: 14, region: 'Midwest', side: 'Right' },
  { id: 'midwest-7-mississippi-state', name: 'Mississippi State',  seed:  7, region: 'Midwest', side: 'Right' },
  { id: 'midwest-10-mississippi',      name: 'Mississippi',        seed: 10, region: 'Midwest', side: 'Right' },
  { id: 'midwest-2-kansas',            name: 'Kansas',             seed:  2, region: 'Midwest', side: 'Right' },
  { id: 'midwest-15-wright-state',     name: 'Wright State',       seed: 15, region: 'Midwest', side: 'Right' },

  // East region (Right side)
  { id: 'east-1-duke',                name: 'Duke',              seed:  1, region: 'East',    side: 'Right' },
  { id: 'east-16-norfolk-state',      name: 'Norfolk State',     seed: 16, region: 'East',    side: 'Right' },
  { id: 'east-8-usc',                 name: 'USC',               seed:  8, region: 'East',    side: 'Right' },
  { id: 'east-9-villanova',           name: 'Villanova',         seed:  9, region: 'East',    side: 'Right' },
  { id: 'east-5-iowa-state',          name: 'Iowa State',        seed:  5, region: 'East',    side: 'Right' },
  { id: 'east-12-akron',              name: 'Akron',             seed: 12, region: 'East',    side: 'Right' },
  { id: 'east-4-tennessee',           name: 'Tennessee',         seed:  4, region: 'East',    side: 'Right' },
  { id: 'east-13-chattanooga',        name: 'Chattanooga',       seed: 13, region: 'East',    side: 'Right' },
  { id: 'east-6-ohio-state',          name: 'Ohio State',        seed:  6, region: 'East',    side: 'Right' },
  { id: 'east-11-georgia',            name: 'Georgia',           seed: 11, region: 'East',    side: 'Right' },
  { id: 'east-3-arizona',             name: 'Arizona',           seed:  3, region: 'East',    side: 'Right' },
  { id: 'east-14-south-dakota-state', name: 'So. Dakota State',  seed: 14, region: 'East',    side: 'Right' },
  { id: 'east-7-vanderbilt',          name: 'Vanderbilt',        seed:  7, region: 'East',    side: 'Right' },
  { id: 'east-10-san-diego-state',    name: 'San Diego State',   seed: 10, region: 'East',    side: 'Right' },
  { id: 'east-2-connecticut',         name: 'Connecticut',       seed:  2, region: 'East',    side: 'Right' },
  { id: 'east-15-eastern-kentucky',   name: 'Eastern Kentucky',  seed: 15, region: 'East',    side: 'Right' },
];

// ---------------------------------------------------------------------------
// Year registry. To add 2027 in code, define TEAMS_2027 and add it here.
// For the production workflow, admins use the Bracket Setup admin page to
// upload teams to the DB — that overrides this code-side fallback.
// ---------------------------------------------------------------------------

const TEAMS_BY_YEAR: Record<number, readonly Team[]> = {
  2026: TEAMS_2026,
};

// ---------------------------------------------------------------------------
// DB-backed override cache.
//
// Loaded at server startup (see initTeamsCache below) and refreshed whenever
// the admin saves a new bracket. We keep this in-memory cache so the rest of
// the codebase can call `teamsForYear()` synchronously without threading
// async/await through scoring, validation, and every route.
// ---------------------------------------------------------------------------

let DB_OVERRIDE: Record<number, readonly Team[]> = {};

/**
 * Replace the in-memory override for a single year. Called by the bracket
 * admin endpoints after a successful save.
 */
export function setTeamsOverride(year: number, teams: readonly Team[]): void {
  DB_OVERRIDE = { ...DB_OVERRIDE, [year]: teams };
}

/**
 * Replace the entire override cache. Called once at server startup.
 */
export function replaceTeamsOverride(byYear: Record<number, readonly Team[]>): void {
  DB_OVERRIDE = { ...byYear };
}

/**
 * Look up the 64-team field for a given year.
 *   1. Prefer the DB-backed override if admins have uploaded one
 *   2. Otherwise fall back to the code-side TEAMS_BY_YEAR
 *   3. Otherwise throw — the year is genuinely unknown
 */
export function teamsForYear(year: number): readonly Team[] {
  const override = DB_OVERRIDE[year];
  if (override && override.length > 0) return override;
  const fallback = TEAMS_BY_YEAR[year];
  if (!fallback) {
    throw new Error(
      `No bracket configured for year ${year} (no DB rows, no code-side fallback).`,
    );
  }
  return fallback;
}

/** Has an admin uploaded a bracket for this year? Useful for the admin UI. */
export function hasDbBracket(year: number): boolean {
  return Boolean(DB_OVERRIDE[year]?.length);
}

// ---------------------------------------------------------------------------
// Bracket construction
// ---------------------------------------------------------------------------

/**
 * Build the 63-game bracket tree for a given year. The output is fully
 * deterministic — same year, same structure, every time.
 */
export function buildGames(year: number): Game[] {
  const teams = teamsForYear(year);
  const teamByRegionSeed = new Map<string, string>();
  for (const t of teams) teamByRegionSeed.set(`${t.region}-${t.seed}`, t.id);

  const games: Game[] = [];

  for (const region of REGION_ORDER) {
    // Round 0 (first round): 8 games per region
    FIRST_ROUND_SEED_PAIRS.forEach(([high, low], i) => {
      const a = teamByRegionSeed.get(`${region}-${high}`);
      const b = teamByRegionSeed.get(`${region}-${low}`);
      if (!a || !b) {
        throw new Error(`Missing team for ${region} seeds ${high}/${low} in year ${year}`);
      }
      games.push({
        id: `${region.toLowerCase()}-r1-g${i + 1}`,
        round: 0,
        region,
        label: `${region} Game ${i + 1}`,
        bracketLabel: `${high} vs ${low}`,
        participants: [a, b],
      });
    });

    // Round 1 (second round): 4 games
    for (let i = 0; i < 4; i += 1) {
      games.push({
        id: `${region.toLowerCase()}-r2-g${i + 1}`,
        round: 1,
        region,
        label: `${region} Round 2`,
        bracketLabel: `Winners of ${i * 2 + 1} and ${i * 2 + 2}`,
        from: [
          `${region.toLowerCase()}-r1-g${i * 2 + 1}`,
          `${region.toLowerCase()}-r1-g${i * 2 + 2}`,
        ],
      });
    }

    // Round 2 (Sweet 16): 2 games
    for (let i = 0; i < 2; i += 1) {
      games.push({
        id: `${region.toLowerCase()}-r3-g${i + 1}`,
        round: 2,
        region,
        label: `${region} Sweet 16`,
        bracketLabel: 'Round 2 winners',
        from: [
          `${region.toLowerCase()}-r2-g${i * 2 + 1}`,
          `${region.toLowerCase()}-r2-g${i * 2 + 2}`,
        ],
      });
    }

    // Round 3 (Elite 8): 1 game
    games.push({
      id: `${region.toLowerCase()}-r4-g1`,
      round: 3,
      region,
      label: `${region} Elite 8`,
      bracketLabel: 'Sweet 16 winners',
      from: [`${region.toLowerCase()}-r3-g1`, `${region.toLowerCase()}-r3-g2`],
    });
  }

  // Round 4 (Final Four): 2 games. South vs Midwest, West vs East — preserves
  // the original index.html's pairings.
  games.push({
    id: 'final-four-1',
    round: 4,
    label: 'Final Four 1',
    bracketLabel: 'South vs Midwest',
    from: ['south-r4-g1', 'midwest-r4-g1'],
  });
  games.push({
    id: 'final-four-2',
    round: 4,
    label: 'Final Four 2',
    bracketLabel: 'West vs East',
    from: ['west-r4-g1', 'east-r4-g1'],
  });

  // Round 5 (Championship): 1 game.
  games.push({
    id: 'championship',
    round: 5,
    label: 'National Championship',
    bracketLabel: 'Final Four winners',
    from: ['final-four-1', 'final-four-2'],
  });

  return games;
}

/** Look up a team by id for a given year. Returns null if not found. */
export function findTeam(year: number, teamId: string): Team | null {
  const teams = teamsForYear(year);
  return teams.find((t) => t.id === teamId) ?? null;
}

/** Build a year-scoped lookup map. Useful inside scoring/validation hot paths. */
export function teamMapForYear(year: number): Map<string, Team> {
  const m = new Map<string, Team>();
  for (const t of teamsForYear(year)) m.set(t.id, t);
  return m;
}
