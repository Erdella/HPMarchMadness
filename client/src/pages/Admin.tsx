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

import { useEffect, useMemo, useState } from 'react';
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

      {/* Entries dashboard */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg tracking-wider text-gold-400">Entries</h2>
        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-[1fr_120px_120px_80px] items-center gap-3 border-b border-ink-700 bg-ink-700/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-paper-faint">
            <span>Entry</span>
            <span>Method</span>
            <span>Status</span>
            <span></span>
          </div>
          {entries.length === 0 && (
            <div className="px-4 py-6 text-sm text-paper-dim">No entries yet.</div>
          )}
          <ul>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="grid grid-cols-[1fr_120px_120px_80px] items-center gap-3 border-b border-ink-700 px-4 py-2 text-sm last:border-0"
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
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
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
