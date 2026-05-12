/**
 * Historical results importer.
 *
 * Parses round-by-round winners for a past tournament. Format is designed so
 * an admin can transcribe from a printed/Sheets bracket in ~5 minutes per
 * year without needing to know game IDs.
 *
 * Format (sections are uppercase region names; the section list is fixed):
 *
 *   SOUTH
 *   <8 R1 winners — comma-separated, in seed-pair order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15>
 *   <4 R2 winners>
 *   <2 Sweet 16 winners>
 *   <1 Elite 8 winner>
 *
 *   WEST
 *   ... (same layout)
 *
 *   MIDWEST
 *   ...
 *
 *   EAST
 *   ...
 *
 *   FINAL FOUR
 *   <2 winners — in pairing order: semifinal-1 winner, semifinal-2 winner>
 *
 *   CHAMPIONSHIP
 *   <1 winner>
 *
 * Team names are resolved against the year's bracket. Comments (#) and blank
 * lines are ignored. Re-importing overwrites any existing results for the year.
 */

import type { Team, FinalFourPairings } from '../config/teams.js';
import { resolveTeam, parseTeamString } from './entriesImport.js';

export interface ResolvedResult {
  gameId: string;
  winnerTeamId: string;
}

export interface ResultsImportIssue {
  line: number;
  message: string;
}

export type ResultsImportResult =
  | { ok: true; results: ResolvedResult[] }
  | { ok: false; errors: ResultsImportIssue[] };

interface ParseContext {
  year: number;
  yearTeams: readonly Team[];
  pairings: FinalFourPairings;
}

interface Section {
  header: string;
  startLine: number;
  /** Each is {line, raw} for a non-blank, non-comment line. */
  lines: Array<{ line: number; text: string }>;
}

// Map a region header → ordered round game-IDs for that region.
function regionGameIds(region: string): Record<number, string[]> {
  const r = region.toLowerCase();
  return {
    1: Array.from({ length: 8 }, (_, i) => `${r}-r1-g${i + 1}`),
    2: Array.from({ length: 4 }, (_, i) => `${r}-r2-g${i + 1}`),
    3: Array.from({ length: 2 }, (_, i) => `${r}-r3-g${i + 1}`),
    4: [`${r}-r4-g1`],
  };
}

const REGION_HEADERS = ['SOUTH', 'WEST', 'MIDWEST', 'EAST'] as const;
const F4_HEADER = 'FINAL FOUR';
const CHAMP_HEADER = 'CHAMPIONSHIP';

/** Try to resolve a team name to a team object. */
function lookupTeam(name: string, ctx: ParseContext): Team | null {
  const cleaned = name.trim();
  // Try parse-with-seed first (in case the user pasted "Duke (1)" style)
  const parsed = parseTeamString(cleaned);
  if (parsed) {
    const resolved = resolveTeam(parsed, ctx.yearTeams);
    if (resolved) return resolved;
  }
  // Fall back to name-only lookup (any seed). Helpful since round winners
  // are uniquely identifiable by name within a year's roster.
  const lower = cleaned.toLowerCase();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(cleaned);
  let exact: Team | null = null;
  let fuzzy: Team | null = null;
  for (const t of ctx.yearTeams) {
    if (t.name.toLowerCase() === lower) exact = t;
    if (norm(t.name) === target) fuzzy ??= t;
  }
  return exact ?? fuzzy ?? null;
}

/** Split tokens in a comma-separated line, trim, drop empties. */
function splitNames(line: string): string[] {
  return line
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRegionSection(
  section: Section,
  region: string,
  ctx: ParseContext,
  out: ResolvedResult[],
  errors: ResultsImportIssue[],
): void {
  const gids = regionGameIds(region);
  const expected = [8, 4, 2, 1] as const;
  const roundLabels = ['R1', 'R2', 'Sweet 16', 'Elite 8'];

  if (section.lines.length !== 4) {
    errors.push({
      line: section.startLine,
      message: `${region}: expected 4 round lines (R1/R2/S16/E8), got ${section.lines.length}.`,
    });
    return;
  }

  for (let round = 1; round <= 4; round += 1) {
    const lineEntry = section.lines[round - 1]!;
    const names = splitNames(lineEntry.text);
    const expectedCount = expected[round - 1]!;
    if (names.length !== expectedCount) {
      errors.push({
        line: lineEntry.line,
        message: `${region} ${roundLabels[round - 1]}: expected ${expectedCount} winners, got ${names.length}.`,
      });
      continue;
    }
    const gameIds = gids[round]!;
    names.forEach((name, i) => {
      const team = lookupTeam(name, ctx);
      if (!team) {
        errors.push({
          line: lineEntry.line,
          message: `${region} ${roundLabels[round - 1]}: unknown team "${name}".`,
        });
        return;
      }
      out.push({ gameId: gameIds[i]!, winnerTeamId: team.id });
    });
  }
}

function parseFinalFourSection(
  section: Section,
  ctx: ParseContext,
  out: ResolvedResult[],
  errors: ResultsImportIssue[],
): void {
  if (section.lines.length !== 1) {
    errors.push({
      line: section.startLine,
      message: `FINAL FOUR: expected 1 line with 2 winners, got ${section.lines.length} non-blank lines.`,
    });
    return;
  }
  const line = section.lines[0]!;
  const names = splitNames(line.text);
  if (names.length !== 2) {
    errors.push({
      line: line.line,
      message: `FINAL FOUR: expected 2 winners (semifinal 1, semifinal 2), got ${names.length}.`,
    });
    return;
  }
  ['final-four-1', 'final-four-2'].forEach((gameId, i) => {
    const team = lookupTeam(names[i]!, ctx);
    if (!team) {
      errors.push({ line: line.line, message: `FINAL FOUR: unknown team "${names[i]}".` });
      return;
    }
    out.push({ gameId, winnerTeamId: team.id });
  });
}

function parseChampionshipSection(
  section: Section,
  ctx: ParseContext,
  out: ResolvedResult[],
  errors: ResultsImportIssue[],
): void {
  if (section.lines.length !== 1) {
    errors.push({
      line: section.startLine,
      message: `CHAMPIONSHIP: expected 1 line with 1 winner, got ${section.lines.length}.`,
    });
    return;
  }
  const line = section.lines[0]!;
  const names = splitNames(line.text);
  if (names.length !== 1) {
    errors.push({
      line: line.line,
      message: `CHAMPIONSHIP: expected exactly 1 winner, got ${names.length}.`,
    });
    return;
  }
  const team = lookupTeam(names[0]!, ctx);
  if (!team) {
    errors.push({ line: line.line, message: `CHAMPIONSHIP: unknown team "${names[0]}".` });
    return;
  }
  out.push({ gameId: 'championship', winnerTeamId: team.id });
}

/** Split text into sections keyed by uppercased header line. */
function splitSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const lineNum = i + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const upper = trimmed.toUpperCase();
    if (
      REGION_HEADERS.includes(upper as (typeof REGION_HEADERS)[number]) ||
      upper === F4_HEADER ||
      upper === CHAMP_HEADER
    ) {
      current = { header: upper, startLine: lineNum, lines: [] };
      sections.push(current);
      return;
    }

    if (!current) {
      // Stray content before any section header — ignore. The first header is
      // mandatory and will surface as a missing-section error below.
      return;
    }
    current.lines.push({ line: lineNum, text: trimmed });
  });

  return sections;
}

export function parseResultsImport(
  text: string,
  year: number,
  yearTeams: readonly Team[],
  pairings: FinalFourPairings,
): ResultsImportResult {
  if (yearTeams.length === 0) {
    return {
      ok: false,
      errors: [
        { line: 0, message: `No bracket configured for ${year}. Upload teams via Bracket Setup first.` },
      ],
    };
  }

  const ctx: ParseContext = { year, yearTeams, pairings };
  const sections = splitSections(text);
  const errors: ResultsImportIssue[] = [];
  const results: ResolvedResult[] = [];

  const sectionMap = new Map<string, Section>();
  for (const s of sections) {
    if (sectionMap.has(s.header)) {
      errors.push({
        line: s.startLine,
        message: `Duplicate section "${s.header}".`,
      });
      continue;
    }
    sectionMap.set(s.header, s);
  }

  for (const region of REGION_HEADERS) {
    const section = sectionMap.get(region);
    if (!section) {
      errors.push({ line: 0, message: `Missing section "${region}".` });
      continue;
    }
    parseRegionSection(section, region, ctx, results, errors);
  }

  const f4 = sectionMap.get(F4_HEADER);
  if (!f4) errors.push({ line: 0, message: `Missing section "FINAL FOUR".` });
  else parseFinalFourSection(f4, ctx, results, errors);

  const champ = sectionMap.get(CHAMP_HEADER);
  if (!champ) errors.push({ line: 0, message: `Missing section "CHAMPIONSHIP".` });
  else parseChampionshipSection(champ, ctx, results, errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, results };
}
