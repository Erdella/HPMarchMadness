/**
 * Nerd Stats — cross-year leaderboard archaeology.
 *
 * Three views stacked:
 *   1. Top 10 highest individual scores ever (year + player + score)
 *   2. Wall of Shame — top 10 lowest individual scores ever
 *   3. Per-player aggregates — years played, lowest/highest with year, average
 *
 * All come from a single GET /api/stats call. Only completed years
 * (championship game recorded) factor in — mid-tournament partials would
 * pollute averages.
 */

import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';

interface TopScoreRow {
  year: number;
  displayName: string;
  score: number;
  entryId: string;
}

interface PlayerStatsRow {
  displayName: string;
  yearsPlayed: number;
  yearsList: number[];
  totalEntries: number;
  lowestScore: number;
  lowestYear: number;
  highestScore: number;
  highestYear: number;
  averageScore: number;
}

interface StatsResponse {
  completeYears: number[];
  totalEntries: number;
  topScores: TopScoreRow[];
  bottomScores: TopScoreRow[];
  players: PlayerStatsRow[];
}

type SortKey =
  | 'yearsPlayed'
  | 'averageScore'
  | 'highestScore'
  | 'lowestScore'
  | 'displayName';

export function Stats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('yearsPlayed');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    apiFetch<StatsResponse>('/api/stats')
      .then((d) => {
        if (cancelled) return;
        setData(d);
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
  }, []);

  const filteredPlayers = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    let rows = q
      ? data.players.filter((p) => p.displayName.toLowerCase().includes(q))
      : [...data.players];

    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'displayName') {
        return a.displayName.localeCompare(b.displayName) * dir;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return 0;
    });
    return rows;
  }, [data, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'displayName' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="flex flex-col gap-8 py-2">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">
          Cross-year stats
        </span>
        <h1 className="font-display text-3xl tracking-wider text-gold-400">Nerd stats</h1>
        {data && (
          <p className="text-sm text-paper-dim">
            Aggregating {data.totalEntries} scored entries across{' '}
            <span className="font-mono text-paper">{data.completeYears.length}</span> completed
            year{data.completeYears.length === 1 ? '' : 's'}:{' '}
            <span className="font-mono">
              {data.completeYears.length > 0
                ? `${data.completeYears[0]}–${data.completeYears[data.completeYears.length - 1]}`
                : 'none yet'}
            </span>
            . Mid-tournament partial scores aren't counted.
            {spansCovid(data.completeYears) && (
              <>
                {' '}
                <span className="font-mono text-paper-faint">
                  (No tournament in 2020 — cancelled due to COVID-19.)
                </span>
              </>
            )}
          </p>
        )}
      </header>

      {loading && (
        <div className="font-mono text-xs uppercase tracking-widest text-paper-faint">Loading…</div>
      )}
      {error && (
        <div className="card border-red-400/40 text-sm text-red-400">
          Couldn't load stats: {error}
        </div>
      )}

      {data && data.completeYears.length === 0 && (
        <div className="card text-sm text-paper-dim">
          No completed years yet — stats become available once a year has the championship game
          recorded.
        </div>
      )}

      {data && data.topScores.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg tracking-wider text-gold-400">
            Top 10 scores ever
          </h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-700 bg-ink-700/40 font-mono text-[10px] uppercase tracking-widest text-paper-faint">
                <tr>
                  <th className="px-4 py-2 text-left">Rank</th>
                  <th className="px-4 py-2 text-left">Year</th>
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="px-4 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.topScores.map((row, i) => {
                  const top = i === 0;
                  return (
                    <tr key={row.entryId} className="border-b border-ink-700 last:border-0">
                      <td
                        className={
                          'px-4 py-2 font-mono ' + (top ? 'text-gold-400' : 'text-paper-dim')
                        }
                      >
                        {String(i + 1).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-2 font-mono text-paper">{row.year}</td>
                      <td className="px-4 py-2">
                        <span className={top ? 'font-medium text-gold-400' : ''}>
                          {row.displayName}
                        </span>
                      </td>
                      <td
                        className={
                          'px-4 py-2 text-right font-mono ' +
                          (top ? 'text-gold-400' : 'text-paper')
                        }
                      >
                        {row.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && data.bottomScores.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg tracking-wider text-maroon-400">
            Wall of Shame
          </h2>
          <p className="-mt-1 text-xs text-paper-faint">
            The 10 lowest scores ever recorded. No one is safe.
          </p>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-700 bg-ink-700/40 font-mono text-[10px] uppercase tracking-widest text-paper-faint">
                <tr>
                  <th className="px-4 py-2 text-left">Rank</th>
                  <th className="px-4 py-2 text-left">Year</th>
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="px-4 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.bottomScores.map((row, i) => {
                  const worst = i === 0;
                  return (
                    <tr key={row.entryId} className="border-b border-ink-700 last:border-0">
                      <td
                        className={
                          'px-4 py-2 font-mono ' +
                          (worst ? 'text-maroon-400' : 'text-paper-dim')
                        }
                      >
                        {String(i + 1).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-2 font-mono text-paper">{row.year}</td>
                      <td className="px-4 py-2">
                        <span className={worst ? 'font-medium text-maroon-400' : ''}>
                          {row.displayName}
                        </span>
                      </td>
                      <td
                        className={
                          'px-4 py-2 text-right font-mono ' +
                          (worst ? 'text-maroon-400' : 'text-paper')
                        }
                      >
                        {row.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && data.players.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg tracking-wider text-gold-400">Players</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input max-w-xs"
              placeholder="Filter by name…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-paper-faint">
              {filteredPlayers.length} player{filteredPlayers.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-700 bg-ink-700/40 font-mono text-[10px] uppercase tracking-widest text-paper-faint">
                <tr>
                  <SortableTh
                    label="Player"
                    keyName="displayName"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    align="left"
                  />
                  <SortableTh
                    label="Years"
                    keyName="yearsPlayed"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableTh
                    label="Avg"
                    keyName="averageScore"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableTh
                    label="Best"
                    keyName="highestScore"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableTh
                    label="Worst"
                    keyName="lowestScore"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p) => (
                  <tr key={p.displayName} className="border-b border-ink-700 last:border-0">
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium">{p.displayName}</span>
                        <span className="text-xs text-paper-faint">
                          {p.totalEntries} entr{p.totalEntries === 1 ? 'y' : 'ies'} ·{' '}
                          {p.yearsList.join(', ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-paper">
                      {p.yearsPlayed}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-paper">
                      {p.averageScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <span className="text-gold-400">{p.highestScore}</span>
                      <span className="ml-1 text-[10px] text-paper-faint">
                        ({p.highestYear})
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <span className="text-paper-dim">{p.lowestScore}</span>
                      <span className="ml-1 text-[10px] text-paper-faint">
                        ({p.lowestYear})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filter && filteredPlayers.length === 0 && (
            <div className="card text-sm text-paper-dim">No players matching "{filter}".</div>
          )}
        </section>
      )}
    </div>
  );
}

// The 2020 NCAA tournament was cancelled on March 12, 2020 due to COVID-19 —
// the only time the tournament has ever been cancelled. If our completed-year
// range straddles 2020, flag it so the year-range "YYYY–YYYY" doesn't read as
// an unbroken run.
function spansCovid(years: number[]): boolean {
  if (years.length < 2) return false;
  const first = years[0]!;
  const last = years[years.length - 1]!;
  return first <= 2019 && last >= 2021;
}

function SortableTh({
  label,
  keyName,
  activeKey,
  dir,
  onClick,
  align,
}: {
  label: string;
  keyName: SortKey;
  activeKey: SortKey;
  dir: 'asc' | 'desc';
  onClick(key: SortKey): void;
  align: 'left' | 'right';
}) {
  const active = activeKey === keyName;
  const arrow = active ? (dir === 'asc' ? '↑' : '↓') : '';
  return (
    <th
      className={
        'px-4 py-2 cursor-pointer select-none transition-colors hover:text-gold-400 ' +
        (active ? 'text-gold-400 ' : '') +
        (align === 'right' ? 'text-right' : 'text-left')
      }
      onClick={() => onClick(keyName)}
    >
      {label} {arrow}
    </th>
  );
}
