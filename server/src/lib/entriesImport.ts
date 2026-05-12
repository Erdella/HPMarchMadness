/**
 * Historical entries importer.
 *
 * Takes a tab-separated paste from a past year's Google Sheet ("Form Responses"
 * tab) and resolves it into a list of entries ready to insert.
 *
 * Expected columns per row (in this exact order, matching the form's column
 * layout in HP March Madness sheets going back to 2010):
 *
 *   0. Timestamp                          (ignored — we use submittedAt = now)
 *   1. Name                               → entry.displayName
 *   2. Email                              → user lookup / creation
 *   3. #1 Seeds (1 team)                  → picks
 *   4. #2–3 Seeds (2 teams, comma-sep)    → picks
 *   5. #4–7 Seeds (3 teams, comma-sep)    → picks
 *   6. #8–11 Seeds (4 teams, comma-sep)   → picks
 *   7. #12–16 Seeds (5 teams, comma-sep)  → picks
 *   8. Payment method (free text)         → mapped to enum
 *
 * Team strings inside the bucket columns are permissive:
 *   "Duke (1)"        — parens for seed
 *   "Miami (OH) 11"   — parens are part of the name, trailing seed is bare
 *   "Saint Mary's (7)"— apostrophes and punctuation OK
 */

import type { PaymentMethod } from '../db/schema.js';
import type { Team } from '../config/teams.js';

export interface ParsedEntry {
  rowNumber: number;
  displayName: string;
  email: string;
  picks: string[]; // team IDs resolved against the year's bracket
  paymentMethod: PaymentMethod;
  paymentMethodNote: string | null;
}

export interface ImportIssue {
  rowNumber: number;
  message: string;
}

export type EntriesImportResult =
  | { ok: true; entries: ParsedEntry[]; warnings: ImportIssue[] }
  | { ok: false; errors: ImportIssue[] };

// ---------------------------------------------------------------------------
// Team-string parsing
// ---------------------------------------------------------------------------

/** Parse a single team string into name + seed, or null if unparseable. */
export function parseTeamString(s: string): { name: string; seed: number } | null {
  const cleaned = s.trim();
  if (!cleaned) return null;

  // Trailing "(N)" — parens around the seed (lazy capture allows names with their own parens)
  const parenMatch = cleaned.match(/^(.+?)\s*\((\d{1,2})\)\s*$/);
  if (parenMatch) {
    const seed = Number(parenMatch[2]);
    if (seed >= 1 && seed <= 16) return { name: parenMatch[1]!.trim(), seed };
  }

  // Trailing bare " N" (no parens) — e.g. "Miami (OH) 11"
  const bareMatch = cleaned.match(/^(.+?)\s+(\d{1,2})\s*$/);
  if (bareMatch) {
    const seed = Number(bareMatch[2]);
    if (seed >= 1 && seed <= 16) return { name: bareMatch[1]!.trim(), seed };
  }

  return null;
}

/** Resolve a parsed (name, seed) to a team ID against the year's roster. */
export function resolveTeam(
  parsed: { name: string; seed: number },
  yearTeams: readonly Team[],
): Team | null {
  const lowerName = parsed.name.toLowerCase();
  // 1. Exact case-insensitive name + seed match
  for (const t of yearTeams) {
    if (t.seed === parsed.seed && t.name.toLowerCase() === lowerName) return t;
  }
  // 2. Fuzzy: strip non-alphanumeric and retry
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(parsed.name);
  for (const t of yearTeams) {
    if (t.seed === parsed.seed && norm(t.name) === target) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Payment method mapping (free text → enum)
// ---------------------------------------------------------------------------

function classifyPayment(raw: string): { method: PaymentMethod; note: string | null } {
  const s = raw.trim();
  const lower = s.toLowerCase();
  let method: PaymentMethod;
  if (lower.includes('venmo')) method = 'venmo';
  else if (lower.includes('paypal') || lower.includes('pay pal')) method = 'paypal';
  else if (lower.includes('check') || lower.includes('mail')) method = 'check';
  else method = 'other';
  return { method, note: s.length > 0 ? s : null };
}

// ---------------------------------------------------------------------------
// Row + sheet parsing
// ---------------------------------------------------------------------------

const BUCKET_COLUMNS_AND_COUNTS = [
  { col: 3, expected: 1, label: '#1 seeds' },
  { col: 4, expected: 2, label: '#2–3 seeds' },
  { col: 5, expected: 3, label: '#4–7 seeds' },
  { col: 6, expected: 4, label: '#8–11 seeds' },
  { col: 7, expected: 5, label: '#12–16 seeds' },
] as const;

interface ParseContext {
  year: number;
  yearTeams: readonly Team[];
}

function parseRow(rowNumber: number, rawRow: string, ctx: ParseContext): {
  ok: true;
  entry: ParsedEntry;
} | {
  ok: false;
  errors: ImportIssue[];
} {
  const cols = rawRow.split('\t');
  const errors: ImportIssue[] = [];

  // Expect at least 9 columns. Some sheets may have extra trailing columns —
  // that's fine, we just ignore them.
  if (cols.length < 9) {
    return {
      ok: false,
      errors: [
        {
          rowNumber,
          message: `Expected at least 9 tab-separated columns, got ${cols.length}. Are you pasting from a Google Sheet?`,
        },
      ],
    };
  }

  const displayName = (cols[1] ?? '').trim();
  const email = (cols[2] ?? '').trim().toLowerCase();
  if (!displayName) errors.push({ rowNumber, message: 'Name column is empty.' });
  if (!email) errors.push({ rowNumber, message: 'Email column is empty.' });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push({ rowNumber, message: `Email looks invalid: "${email}".` });

  const picks: string[] = [];
  for (const bucket of BUCKET_COLUMNS_AND_COUNTS) {
    const raw = cols[bucket.col] ?? '';
    const teamStrings = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (teamStrings.length !== bucket.expected) {
      errors.push({
        rowNumber,
        message: `${bucket.label}: expected ${bucket.expected} team(s), found ${teamStrings.length} in "${raw}".`,
      });
      continue;
    }
    for (const ts of teamStrings) {
      const parsed = parseTeamString(ts);
      if (!parsed) {
        errors.push({ rowNumber, message: `Couldn't parse team string "${ts}".` });
        continue;
      }
      const team = resolveTeam(parsed, ctx.yearTeams);
      if (!team) {
        errors.push({
          rowNumber,
          message: `Couldn't find team "${parsed.name}" with seed ${parsed.seed} in ${ctx.year} bracket.`,
        });
        continue;
      }
      // Verify seed actually matches a bucket member
      if (!seedInBucket(team.seed, bucket.expected)) {
        // This can only happen if our bucket-definition logic is wrong; safe guard.
        errors.push({
          rowNumber,
          message: `Team "${team.name}" has seed ${team.seed} which doesn't fit ${bucket.label}.`,
        });
      }
      picks.push(team.id);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Final sanity check — 15 unique picks total
  if (picks.length !== 15) {
    return {
      ok: false,
      errors: [{ rowNumber, message: `Ended up with ${picks.length} picks, expected 15.` }],
    };
  }
  if (new Set(picks).size !== picks.length) {
    return {
      ok: false,
      errors: [{ rowNumber, message: 'Duplicate team within picks.' }],
    };
  }

  const payment = classifyPayment(cols[8] ?? '');

  return {
    ok: true,
    entry: {
      rowNumber,
      displayName,
      email,
      picks,
      paymentMethod: payment.method,
      paymentMethodNote: payment.note,
    },
  };
}

/** True if a seed fits inside one of the named buckets by expected size. */
function seedInBucket(seed: number, expectedCount: number): boolean {
  switch (expectedCount) {
    case 1: return seed === 1;
    case 2: return seed >= 2 && seed <= 3;
    case 3: return seed >= 4 && seed <= 7;
    case 4: return seed >= 8 && seed <= 11;
    case 5: return seed >= 12 && seed <= 16;
    default: return false;
  }
}

/**
 * Main entry point: parse the whole pasted blob.
 */
export function parseEntriesImport(
  text: string,
  year: number,
  yearTeams: readonly Team[],
): EntriesImportResult {
  if (yearTeams.length === 0) {
    return {
      ok: false,
      errors: [
        { rowNumber: 0, message: `No bracket configured for ${year}. Upload teams first via Bracket Setup.` },
      ],
    };
  }

  const ctx: ParseContext = { year, yearTeams };
  const rows = text.split(/\r?\n/);
  const entries: ParsedEntry[] = [];
  const errors: ImportIssue[] = [];
  let rowNumber = 0;

  // Detect a header row (column names) and skip it. We look for "Name" or "email"
  // tokens in the first non-blank line.
  let headerSkipped = false;

  for (const raw of rows) {
    rowNumber += 1;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;

    if (!headerSkipped) {
      const lower = trimmed.toLowerCase();
      if (
        lower.includes('timestamp') ||
        lower.includes('email') ||
        lower.includes('#1 seed')
      ) {
        headerSkipped = true;
        continue;
      }
      headerSkipped = true; // even if it didn't look like a header, only skip once
    }

    const result = parseRow(rowNumber, raw, ctx);
    if (result.ok) entries.push(result.entry);
    else errors.push(...result.errors);
  }

  if (errors.length > 0) return { ok: false, errors };
  if (entries.length === 0) {
    return { ok: false, errors: [{ rowNumber: 0, message: 'No entries found in input.' }] };
  }

  return { ok: true, entries, warnings: [] };
}
