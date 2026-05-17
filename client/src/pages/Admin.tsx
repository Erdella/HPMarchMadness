/**
 * Admin — tournament controls.
 *
 * Three areas:
 *   1. Settings: submissions open/closed toggle (POST /api/admin/lock|unlock)
 *   2. Results: per-game winner entry (PUT /api/results/:gameId)
 *   3. Entries: list with payment toggle (PATCH /api/admin/entries/:id/payment)
 *
 * The Results section walks the bracket tree round by round. A round-2+ game's
 * dropdown only populates once both upstream winners are entered — mirrors how
 * the actual tournament unfolds.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { gameOptions, gamesByRound } from '../lib/bracket';
import { useConfig } from '../lib/config';
import type { AdminSettings, Entry, Game, ResultRow, Team } from '../lib/types';

export function Admin() {
  const config = useConfig();
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({});
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<{ teams: Team[] }>('/api/config/teams'),
      apiFetch<{ games: Game[] }>('/api/config/games'),
      apiFetch<{ entries: Entry[] }>('/api/entries'),
      apiFetch<{ results: ResultRow[] }>('/api/results'),
      apiFetch<{ settings: AdminSettings }>('/api/admin/settings'),
    ])
      .then(([t, g, e, r, s]) => {
        if (cancelled) return;
        setTeams(t.teams);
        setGames(g.games);
        setEntries(e.entries);
        setResults(r.results);
        setSettings(s.settings ?? {});
        setLoading(false);
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        setBootError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const winnerMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of results) m[r.gameId] = r.winnerTeamId;
    return m;
  }, [results]);

  const submissionsClosed = Boolean(settings.submissions_closed);
  const totalEntries = entries.length;
  const paidCount = entries.filter((e) => e.paymentReceived).length;
  const resultsCount = results.length;

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  async function toggleSubmissions() {
    setBusyKey('submissions');
    try {
      const path = submissionsClosed ? '/api/admin/unlock' : '/api/admin/lock';
      await apiFetch(path, { method: 'POST' });
      setSettings((prev) => ({ ...prev, submissions_closed: !submissionsClosed }));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setBusyKey(null);
    }
  }

  async function setWinner(gameId: string, winnerTeamId: string) {
    setBusyKey(`game-${gameId}`);
    try {
      await apiFetch(`/api/results/${encodeURIComponent(gameId)}`, {
        method: 'PUT',
        body: { winnerTeamId },
      });
      setResults((prev) => {
        const others = prev.filter((r) => r.gameId !== gameId);
        return [
          ...others,
          { gameId, winnerTeamId, recordedAt: new Date().toISOString() },
        ];
      });
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setBusyKey(null);
    }
  }

  async function clearWinner(gameId: string) {
    if (!confirm('Clear this winner? Downstream games will be reset.')) return;
    setBusyKey(`game-${gameId}`);
    try {
      await apiFetch(`/api/results/${encodeURIComponent(gameId)}`, { method: 'DELETE' });
      setResults((prev) => prev.filter((r) => r.gameId !== gameId));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setBusyKey(null);
    }
  }

  async function togglePayment(entry: Entry) {
    setBusyKey(`pay-${entry.id}`);
    try {
      const res = await apiFetch<{ entry: Entry }>(
        `/api/admin/entries/${entry.id}/payment`,
        { method: 'PATCH', body: { paymentReceived: !entry.paymentReceived } },
      );
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? res.entry : e)));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setBusyKey(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="font-mono text-xs uppercase tracking-widest text-paper-faint">
        Loading admin…
      </div>
    );
  }
  if (bootError) {
    return (
      <div className="card border-red-400/40 text-sm text-red-400">
        Couldn't load admin data: {bootError}
      </div>
    );
  }

  const byRound = gamesByRound(games);

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">Admin</span>
        <h1 className="font-display text-3xl tracking-wider text-gold-400">Tournament controls</h1>
      </header>

      {/* Status row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-400">Submissions</div>
          <div className="mt-1 font-display text-2xl tracking-wider">
            {submissionsClosed ? 'Closed' : 'Open'}
          </div>
          <button
            type="button"
            className="btn-secondary mt-3 text-xs"
            onClick={toggleSubmissions}
            disabled={busyKey === 'submissions'}
          >
            {busyKey === 'submissions'
              ? 'Working…'
              : submissionsClosed
                ? 'Reopen submissions'
                : 'Lock submissions'}
          </button>
        </div>
        <div className="card">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-400">Entries</div>
          <div className="mt-1 font-display text-2xl tracking-wider">{totalEntries}</div>
          <div className="text-xs text-paper-faint">
            {paidCount} paid · {totalEntries - paidCount} outstanding
          </div>
        </div>
        <div className="card">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-400">Results</div>
          <div className="mt-1 font-display text-2xl tracking-wider">{resultsCount} / 63</div>
          <div className="text-xs text-paper-faint">Games with a recorded winner</div>
        </div>
      </div>

      {/* Results entry */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg tracking-wider text-gold-400">Results</h2>
        {byRound.map((roundGames, roundIndex) => (
          <RoundSection
            key={roundIndex}
            roundIndex={roundIndex}
            games={roundGames}
            winnerMap={winnerMap}
            teamMap={teamMap}
            busyKey={busyKey}
            onSet={setWinner}
            onClear={clearWinner}
          />
        ))}
      </section>

      {/* Bracket setup */}
      <BracketSetup defaultYear={config.year} onSaved={(newTeams) => setTeams(newTeams)} />

      {/* Final Four pairings */}
      <FinalFourPairings defaultYear={config.year} />

      {/* Historical entries import */}
      <EntriesImport defaultYear={config.year} />

      {/* Historical results import */}
      <ResultsImport defaultYear={config.year} />

      {/* Reset year — clean-slate per-year deletion */}
      <ResetYear defaultYear={config.year} onReset={(year, scope) => {
        // After bracket reset for the current view, our teams state is stale
        if ((scope === 'bracket' || scope === 'all') && year === config.year) {
          setTeams([]);
        }
        if ((scope === 'entries' || scope === 'all') && year === config.year) {
          setEntries([]);
        }
        if ((scope === 'results' || scope === 'all') && year === config.year) {
          setResults([]);
        }
      }} />

      {/* Entries dashboard */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg tracking-wider text-gold-400">Entries</h2>
        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-[1fr_110px_100px_100px_90px] items-center gap-3 border-b border-ink-700 bg-ink-700/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-paper-faint">
            <span>Entry</span>
            <span>Method</span>
            <span>Status</span>
            <span></span>
            <span>Picks</span>
          </div>
          {entries.length === 0 && (
            <div className="px-4 py-6 text-sm text-paper-dim">No entries yet.</div>
          )}
          <ul>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="grid grid-cols-[1fr_110px_100px_100px_90px] items-center gap-3 border-b border-ink-700 px-4 py-2 text-sm last:border-0"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{entry.displayName}</span>
                  {entry.paymentMethodNote && (
                    <span className="text-xs text-paper-faint">{entry.paymentMethodNote}</span>
                  )}
                </div>
                <span className="font-mono text-xs uppercase tracking-widest text-paper-dim">
                  {entry.paymentMethod}
                </span>
                <span
                  className={
                    entry.paymentReceived
                      ? 'font-mono text-xs uppercase tracking-widest text-gold-400'
                      : 'font-mono text-xs uppercase tracking-widest text-red-400'
                  }
                >
                  {entry.paymentReceived ? '✓ Paid' : '○ Unpaid'}
                </span>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => togglePayment(entry)}
                  disabled={busyKey === `pay-${entry.id}`}
                >
                  {entry.paymentReceived ? 'Mark unpaid' : 'Mark paid'}
                </button>
                <Link
                  to={`/draft?entry=${entry.id}`}
                  className="rounded-sm border border-ink-700 px-3 py-1 text-center font-mono text-xs uppercase tracking-widest text-paper-dim transition-colors hover:bg-ink-700 hover:text-gold-400"
                >
                  Edit picks
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bracket setup — paste 64 teams to (re)configure a year's tournament field.
// ---------------------------------------------------------------------------

const BRACKET_PLACEHOLDER = `# Paste 64 lines: Region, Seed, Team Name
# Regions: South, West, Midwest, East
#
# Example:
# South,1,Purdue
# South,16,LIU/Little Rock
# South,8,Creighton
# ...

`;

interface BracketImportError {
  line: number;
  message: string;
}

function BracketSetup({
  defaultYear,
  onSaved,
}: {
  defaultYear: number;
  onSaved(teams: Team[]): void;
}) {
  const [year, setYear] = useState<number>(defaultYear);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<BracketImportError[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    setSuccess(null);
    setServerError(null);
    try {
      const res = await apiFetch<{ year: number; count: number; teams: Team[] }>(
        '/api/admin/bracket',
        { method: 'PUT', body: { year, text } },
      );
      setSuccess(`Saved ${res.count} teams for ${res.year}.`);
      onSaved(res.teams);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.body && typeof err.body === 'object') {
        const body = err.body as { error?: string; issues?: BracketImportError[] };
        if (body.error === 'validation_failed' && Array.isArray(body.issues)) {
          setErrors(body.issues);
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg tracking-wider text-gold-400">Bracket setup</h2>
      <p className="text-sm text-paper-dim">
        Paste the Selection Sunday bracket for any tournament year. Format:{' '}
        <span className="font-mono">Region,Seed,Name</span> — one team per line, 64 teams total
        (16 per region across South / West / Midwest / East). Saving overwrites the existing
        bracket for that year — entries already submitted with old team IDs will lose their
        scoring continuity, so only do this before the tournament starts.
      </p>

      <form className="card flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 sm:w-32">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">Year</span>
          <input
            type="number"
            min={2000}
            max={2100}
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
            disabled={submitting}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
            Teams (paste 64 lines)
          </span>
          <textarea
            className="input min-h-[280px] font-mono text-xs"
            placeholder={BRACKET_PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
            spellCheck={false}
          />
        </label>

        {errors.length > 0 && (
          <div className="card border-red-400/50 bg-red-400/5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-red-400">
              {errors.length} problem{errors.length === 1 ? '' : 's'}
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-red-400">
              {errors.slice(0, 20).map((err, i) => (
                <li key={i} className="font-mono">
                  {err.line > 0 ? `line ${err.line}: ` : ''}
                  {err.message}
                </li>
              ))}
              {errors.length > 20 && (
                <li className="text-paper-faint">… and {errors.length - 20} more</li>
              )}
            </ul>
          </div>
        )}

        {serverError && <div className="text-sm text-red-400">{serverError}</div>}
        {success && <div className="text-sm text-gold-400">{success}</div>}

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-paper-faint">
            {text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).length} non-blank
            lines
          </span>
          <button type="submit" className="btn-primary" disabled={submitting || !text.trim()}>
            {submitting ? 'Saving…' : `Save bracket for ${year}`}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Final Four pairings — which regions play each other in each semifinal.
// ---------------------------------------------------------------------------

type Region = 'South' | 'West' | 'Midwest' | 'East';
const REGIONS: readonly Region[] = ['South', 'West', 'Midwest', 'East'];

function FinalFourPairings({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState<number>(defaultYear);
  const [pair1, setPair1] = useState<[Region, Region]>(['South', 'Midwest']);
  const [pair2, setPair2] = useState<[Region, Region]>(['West', 'East']);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load current pairings whenever year changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    apiFetch<{ pairings: [[Region, Region], [Region, Region]] }>(
      `/api/admin/pairings?year=${year}`,
    )
      .then((data) => {
        if (cancelled) return;
        setPair1(data.pairings[0]);
        setPair2(data.pairings[1]);
        setLoading(false);
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  // Validate: each region appears exactly once.
  const allRegions = [pair1[0], pair1[1], pair2[0], pair2[1]];
  const usedSet = new Set(allRegions);
  const valid = usedSet.size === 4;

  async function onSave() {
    if (!valid) {
      setError('Each region must appear exactly once across the two pairs.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/api/admin/pairings', {
        method: 'PUT',
        body: { year, pairings: [pair1, pair2] },
      });
      setSuccess(`Saved Final Four pairings for ${year}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg tracking-wider text-gold-400">Final Four pairings</h2>
      <p className="text-sm text-paper-dim">
        Which regions meet in each semifinal. The NCAA decides this each year — the default of
        South vs Midwest / West vs East is rarely correct. Set this for every year so the
        admin Results dropdowns show the right teams.
      </p>

      <div className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1 sm:w-32">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">Year</span>
          <input
            type="number"
            min={2000}
            max={2100}
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
            disabled={loading || saving}
          />
        </label>

        <div className="flex flex-col gap-3">
          <PairingRow
            label="Semifinal 1"
            left={pair1[0]}
            right={pair1[1]}
            onLeft={(r) => setPair1([r, pair1[1]])}
            onRight={(r) => setPair1([pair1[0], r])}
            disabled={loading || saving}
          />
          <PairingRow
            label="Semifinal 2"
            left={pair2[0]}
            right={pair2[1]}
            onLeft={(r) => setPair2([r, pair2[1]])}
            onRight={(r) => setPair2([pair2[0], r])}
            disabled={loading || saving}
          />
        </div>

        {!valid && (
          <div className="text-sm text-red-400">
            Each region must appear exactly once. Currently using:{' '}
            <span className="font-mono">{allRegions.join(', ')}</span>.
          </div>
        )}
        {error && <div className="text-sm text-red-400">{error}</div>}
        {success && <div className="text-sm text-gold-400">{success}</div>}

        <div className="flex items-center justify-end">
          <button
            type="button"
            className="btn-primary"
            onClick={onSave}
            disabled={loading || saving || !valid}
          >
            {saving ? 'Saving…' : `Save pairings for ${year}`}
          </button>
        </div>
      </div>
    </section>
  );
}

function PairingRow({
  label,
  left,
  right,
  onLeft,
  onRight,
  disabled,
}: {
  label: string;
  left: Region;
  right: Region;
  onLeft(r: Region): void;
  onRight(r: Region): void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 font-mono text-[11px] uppercase tracking-widest text-paper-faint">
        {label}
      </span>
      <RegionSelect value={left} onChange={onLeft} disabled={disabled} />
      <span className="font-mono text-xs text-paper-faint">vs</span>
      <RegionSelect value={right} onChange={onRight} disabled={disabled} />
    </div>
  );
}

function RegionSelect({
  value,
  onChange,
  disabled,
}: {
  value: Region;
  onChange(r: Region): void;
  disabled: boolean;
}) {
  return (
    <select
      className="input w-40"
      value={value}
      onChange={(e) => onChange(e.target.value as Region)}
      disabled={disabled}
    >
      {REGIONS.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Historical entries import — paste a past year's Google Sheet rows.
// ---------------------------------------------------------------------------

const ENTRIES_IMPORT_PLACEHOLDER = `# Paste Form Responses rows from a Google Sheet (tab-separated).
# Each row: Timestamp <tab> Name <tab> Email <tab> #1 picks <tab>
#           #2-3 picks <tab> #4-7 picks <tab> #8-11 picks <tab>
#           #12-16 picks <tab> Payment
#
# A header row is auto-detected and skipped.
# Re-importing replaces ALL entries for the selected year.
`;

interface EntriesImportIssue {
  rowNumber: number;
  message: string;
}

function EntriesImport({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState<number>(defaultYear);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<EntriesImportIssue[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    setSuccess(null);
    setServerError(null);
    try {
      const res = await apiFetch<{ year: number; imported: number; users: number }>(
        '/api/admin/import/entries',
        { method: 'POST', body: { year, text } },
      );
      setSuccess(`Imported ${res.imported} entries (${res.users} users) for ${res.year}.`);
      setText('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.body && typeof err.body === 'object') {
        const body = err.body as { error?: string; message?: string; issues?: EntriesImportIssue[] };
        if (body.error === 'validation_failed' && Array.isArray(body.issues)) {
          setErrors(body.issues);
        } else if (body.error === 'no_bracket_for_year') {
          setServerError(body.message ?? 'No bracket found for that year.');
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg tracking-wider text-gold-400">Historical entries import</h2>
      <p className="text-sm text-paper-dim">
        Backfill a past year's entries from its Google Sheet. Open the
        <span className="font-mono"> Form Responses</span> tab, select the data rows (with or
        without the header), copy, then paste here. Make sure the year's bracket is uploaded
        first via Bracket Setup.
      </p>

      <form className="card flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 sm:w-32">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">Year</span>
          <input
            type="number"
            min={2000}
            max={2100}
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
            disabled={submitting}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
            Paste rows (tab-separated)
          </span>
          <textarea
            className="input min-h-[280px] font-mono text-xs"
            placeholder={ENTRIES_IMPORT_PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
            spellCheck={false}
          />
        </label>

        {errors.length > 0 && (
          <div className="card border-red-400/50 bg-red-400/5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-red-400">
              {errors.length} problem{errors.length === 1 ? '' : 's'}
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-red-400">
              {errors.slice(0, 30).map((err, i) => (
                <li key={i} className="font-mono">
                  {err.rowNumber > 0 ? `row ${err.rowNumber}: ` : ''}
                  {err.message}
                </li>
              ))}
              {errors.length > 30 && (
                <li className="text-paper-faint">… and {errors.length - 30} more</li>
              )}
            </ul>
          </div>
        )}

        {serverError && <div className="text-sm text-red-400">{serverError}</div>}
        {success && <div className="text-sm text-gold-400">{success}</div>}

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-paper-faint">
            {text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).length} non-blank
            lines
          </span>
          <button type="submit" className="btn-primary" disabled={submitting || !text.trim()}>
            {submitting ? 'Importing…' : `Import entries for ${year}`}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Historical results import — paste round-by-round winners for any year.
// ---------------------------------------------------------------------------

const RESULTS_IMPORT_PLACEHOLDER = `# Paste round-by-round winners for one year.
# Each region: 4 lines (R1=8 teams, R2=4, S16=2, E8=1) comma-separated.
# Final Four: 1 line, 2 winners in pairing order.
# Championship: 1 line, 1 winner.
#
# Example:
# SOUTH
# Purdue, Creighton, Bradley, UCLA, Boise / Maryland, St. John's, Oregon, Kentucky
# Purdue, UCLA, St. John's, Kentucky
# Purdue, Kentucky
# Purdue
#
# WEST
# ... (same format)
#
# MIDWEST
# ...
#
# EAST
# ...
#
# FINAL FOUR
# Purdue, Florida
#
# CHAMPIONSHIP
# Florida
`;

interface ResultsImportIssue {
  line: number;
  message: string;
}

function ResultsImport({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState<number>(defaultYear);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ResultsImportIssue[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    setSuccess(null);
    setServerError(null);
    try {
      const res = await apiFetch<{ year: number; imported: number }>(
        '/api/admin/import/results',
        { method: 'POST', body: { year, text } },
      );
      setSuccess(`Imported ${res.imported} game results for ${res.year}.`);
      setText('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.body && typeof err.body === 'object') {
        const body = err.body as { error?: string; message?: string; issues?: ResultsImportIssue[] };
        if (body.error === 'validation_failed' && Array.isArray(body.issues)) {
          setErrors(body.issues);
        } else if (body.error === 'no_bracket_for_year') {
          setServerError(body.message ?? 'No bracket found for that year.');
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg tracking-wider text-gold-400">Historical results import</h2>
      <p className="text-sm text-paper-dim">
        Backfill round-by-round winners for any year. The format follows the bracket structure
        — see the placeholder for an example. Re-importing replaces ALL results for the year.
        Make sure the year's bracket and Final Four pairings are configured first.
      </p>

      <form className="card flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 sm:w-32">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">Year</span>
          <input
            type="number"
            min={2000}
            max={2100}
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
            disabled={submitting}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
            Paste winners by section
          </span>
          <textarea
            className="input min-h-[320px] font-mono text-xs"
            placeholder={RESULTS_IMPORT_PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
            spellCheck={false}
          />
        </label>

        {errors.length > 0 && (
          <div className="card border-red-400/50 bg-red-400/5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-red-400">
              {errors.length} problem{errors.length === 1 ? '' : 's'}
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-red-400">
              {errors.slice(0, 30).map((err, i) => (
                <li key={i} className="font-mono">
                  {err.line > 0 ? `line ${err.line}: ` : ''}
                  {err.message}
                </li>
              ))}
              {errors.length > 30 && (
                <li className="text-paper-faint">… and {errors.length - 30} more</li>
              )}
            </ul>
          </div>
        )}

        {serverError && <div className="text-sm text-red-400">{serverError}</div>}
        {success && <div className="text-sm text-gold-400">{success}</div>}

        <div className="flex items-center justify-end">
          <button type="submit" className="btn-primary" disabled={submitting || !text.trim()}>
            {submitting ? 'Importing…' : `Import results for ${year}`}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Reset year — wipe data for a given year. Mostly used during testing /
// recovery from a bad import.
// ---------------------------------------------------------------------------

type ResetScope = 'results' | 'entries' | 'bracket' | 'all';

const SCOPE_DESCRIPTIONS: Record<ResetScope, string> = {
  results: 'Wipes only the game-by-game winners.',
  entries: 'Wipes only the submitted brackets (entries + picks).',
  bracket: 'Wipes the 64-team field + Final Four pairings + admin settings.',
  all: 'Wipes everything: results, entries, bracket, pairings, settings.',
};

function ResetYear({
  defaultYear,
  onReset,
}: {
  defaultYear: number;
  onReset(year: number, scope: ResetScope): void;
}) {
  const [year, setYear] = useState<number>(defaultYear);
  const [busy, setBusy] = useState<ResetScope | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doReset(scope: ResetScope) {
    const warning =
      scope === 'all'
        ? `Wipe EVERYTHING for ${year}? This deletes results, entries, bracket, and pairings.`
        : `Clear ${scope} for ${year}? ${SCOPE_DESCRIPTIONS[scope]}`;
    if (!confirm(warning)) return;

    setBusy(scope);
    setSuccess(null);
    setError(null);
    try {
      const res = await apiFetch<{
        scope: ResetScope;
        deleted: { results: number; entries: number; teams: number; settings: number };
      }>(`/api/admin/year/${year}/${scope}?confirm=${year}`, { method: 'DELETE' });
      const d = res.deleted;
      const parts: string[] = [];
      if (d.results) parts.push(`${d.results} result${d.results === 1 ? '' : 's'}`);
      if (d.entries) parts.push(`${d.entries} entr${d.entries === 1 ? 'y' : 'ies'}`);
      if (d.teams) parts.push(`${d.teams} team${d.teams === 1 ? '' : 's'}`);
      if (d.settings) parts.push(`${d.settings} setting${d.settings === 1 ? '' : 's'}`);
      setSuccess(`Cleared ${parts.join(' · ') || 'nothing (was already empty)'} for ${year}.`);
      onReset(year, scope);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(null);
    }
  }

  const scopes: ResetScope[] = ['results', 'entries', 'bracket', 'all'];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg tracking-wider text-red-400">Reset year</h2>
      <p className="text-sm text-paper-dim">
        Wipe data for a year and start fresh. Useful when a paste went wrong. Each button only
        clears its specific scope — pick the narrowest one that gets you unstuck. There is no
        undo.
      </p>

      <div className="card flex flex-col gap-4 border-red-400/30">
        <label className="flex flex-col gap-1 sm:w-32">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">Year</span>
          <input
            type="number"
            min={2000}
            max={2100}
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
            disabled={busy !== null}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          {scopes.map((scope) => (
            <button
              key={scope}
              type="button"
              className={
                'flex flex-col items-start gap-1 rounded-sm border px-3 py-2 text-left transition-colors ' +
                (scope === 'all'
                  ? 'border-red-400 bg-red-400/10 text-red-400 hover:bg-red-400/20'
                  : 'border-ink-700 bg-ink-800 text-paper hover:border-red-400/50 hover:bg-ink-700')
              }
              onClick={() => void doReset(scope)}
              disabled={busy !== null}
            >
              <span className="font-mono text-[11px] uppercase tracking-widest">
                {busy === scope
                  ? 'Working…'
                  : scope === 'all'
                    ? `Wipe everything for ${year}`
                    : `Clear ${scope} for ${year}`}
              </span>
              <span className="text-xs text-paper-faint">{SCOPE_DESCRIPTIONS[scope]}</span>
            </button>
          ))}
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        {success && <div className="text-sm text-gold-400">{success}</div>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Round section — collapsible group of games for one round.
// ---------------------------------------------------------------------------
function RoundSection({
  roundIndex,
  games,
  winnerMap,
  teamMap,
  busyKey,
  onSet,
  onClear,
}: {
  roundIndex: number;
  games: Game[];
  winnerMap: Readonly<Record<string, string>>;
  teamMap: ReadonlyMap<string, Team>;
  busyKey: string | null;
  onSet(gameId: string, teamId: string): void;
  onClear(gameId: string): void;
}) {
  const config = useConfig();
  const label = config.roundLabels[roundIndex + 1] ?? `Round ${roundIndex + 1}`;
  const points = config.scoring[roundIndex + 1] ?? 0;
  const completed = games.filter((g) => winnerMap[g.id]).length;

  return (
    <details className="card" open={roundIndex < 2}>
      <summary className="flex cursor-pointer items-baseline justify-between">
        <span className="font-display text-base tracking-wider text-gold-400">{label}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-paper-faint">
          {completed}/{games.length} · {points}pts
        </span>
      </summary>
      <ul className="mt-3 flex flex-col divide-y divide-ink-700">
        {games.map((game) => {
          const options = gameOptions(game, winnerMap, teamMap);
          const winnerId = winnerMap[game.id] ?? '';
          const busy = busyKey === `game-${game.id}`;
          return (
            <li key={game.id} className="grid grid-cols-[1fr_minmax(180px,260px)_60px] items-center gap-3 py-2 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">{game.label}</span>
                <span className="text-xs text-paper-faint">{game.bracketLabel}</span>
              </div>
              {options === null ? (
                <span className="font-mono text-xs uppercase tracking-widest text-paper-faint">
                  Awaiting upstream
                </span>
              ) : (
                <select
                  className="input"
                  value={winnerId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) onSet(game.id, v);
                  }}
                  disabled={busy}
                >
                  <option value="">— pick winner —</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>
                      {String(t.seed).padStart(2, '0')} {t.name}
                    </option>
                  ))}
                </select>
              )}
              {winnerId ? (
                <button
                  type="button"
                  className="text-xs text-paper-dim hover:text-red-400"
                  onClick={() => onClear(game.id)}
                  disabled={busy}
                >
                  Clear
                </button>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
