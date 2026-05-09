/**
 * Leaderboard.
 *
 * Shows ranked standings with per-round score breakdown columns and an
 * inline name filter. Top entry highlighted in gold.
 *
 * Tiebreaker rule per Brett's email: total points first, then R1 points,
 * then R2, ... — the server already sorts that way, so we just render.
 */

import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';
import { useConfig } from '../lib/config';
import type { StandingsRow } from '../lib/types';

interface LeaderboardResponse {
  year: number;
  totalEntries: number;
  standings: StandingsRow[];
}

const ROUND_HEADERS = ['R1', 'R2', 'S16', 'E8', 'F4', 'CHIP'];

export function Leaderboard() {
  const config = useConfig();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    apiFetch<LeaderboardResponse>('/api/leaderboard')
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: ApiError) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.standings;
    return data.standings.filter((row) => row.displayName.toLowerCase().includes(q));
  }, [data, filter]);

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">Standings</span>
          <h1 className="font-display text-3xl tracking-wider text-gold-400">Leaderboard</h1>
        </div>
        {data && (
          <span className="font-mono text-xs uppercase tracking-widest text-paper-faint">
            {data.totalEntries} entries · {data.year}
          </span>
        )}
      </header>

      <p className="text-sm text-paper-dim">
        Scoring: {Object.entries(config.scoring).map(([r, p]) => `R${r}=${p}`).join(' · ')}.
        Ties broken by 1st-round points, then 2nd, then onward.
      </p>

      {loading && (
        <div className="font-mono text-xs uppercase tracking-widest text-paper-faint">Loading…</div>
      )}
      {error && (
        <div className="card border-red-400/40 text-sm text-red-400">
          Couldn't load standings: {error}
        </div>
      )}

      {data && data.standings.length === 0 && (
        <div className="card text-sm text-paper-dim">
          No entries yet. Standings appear once the first entry is in.
        </div>
      )}

      {data && data.standings.length > 0 && (
        <>
          <input
            className="input max-w-xs"
            placeholder="Filter by name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-700 bg-ink-700/40 font-mono text-[10px] uppercase tracking-widest text-paper-faint">
                <tr>
                  <th className="px-4 py-2 text-left">Rank</th>
                  <th className="px-4 py-2 text-left">Entry</th>
                  {ROUND_HEADERS.map((h) => (
                    <th key={h} className="px-2 py-2 text-right">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const top = row.rank === 1;
                  const second = row.rank === 2;
                  const third = row.rank === 3;
                  const rankClass = top
                    ? 'text-gold-400'
                    : second
                      ? 'text-paper'
                      : third
                        ? 'text-maroon-300'
                        : 'text-paper-dim';
                  return (
                    <tr key={row.entryId} className="border-b border-ink-700 last:border-0">
                      <td className={`px-4 py-2 font-mono ${rankClass}`}>
                        {String(row.rank).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-2">
                        <span className={top ? 'font-medium text-gold-400' : ''}>
                          {row.displayName}
                        </span>
                      </td>
                      {row.byRound.map((pts, i) => (
                        <td
                          key={i}
                          className={`px-2 py-2 text-right font-mono text-xs ${
                            pts === 0 ? 'text-paper-faint' : 'text-paper'
                          }`}
                        >
                          {pts}
                        </td>
                      ))}
                      <td
                        className={`px-4 py-2 text-right font-mono ${
                          top ? 'text-gold-400' : 'text-paper'
                        }`}
                      >
                        {row.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filter && filtered.length === 0 && (
            <div className="card text-sm text-paper-dim">
              No entries matching "{filter}".
            </div>
          )}
        </>
      )}
    </div>
  );
}
