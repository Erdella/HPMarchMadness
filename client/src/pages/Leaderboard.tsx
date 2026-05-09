/**
 * Leaderboard.
 *
 * STUB: Milestone 4 hits /api/leaderboard and lists raw standings. M5 layers
 * on filters, sticky top-3 highlight, and per-round score breakdown.
 */

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';

interface StandingsRow {
  entryId: string;
  displayName: string;
  total: number;
  byRound: number[];
  rank: number;
}

interface LeaderboardResponse {
  year: number;
  totalEntries: number;
  standings: StandingsRow[];
}

export function Leaderboard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          No entries yet. Once the first entry is in, it will appear here.
        </div>
      )}

      {data && data.standings.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-[40px_1fr_60px] items-center gap-3 border-b border-ink-700 bg-ink-700/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-paper-faint">
            <span>Rank</span>
            <span>Entry</span>
            <span className="text-right">Score</span>
          </div>
          <ul>
            {data.standings.map((row) => (
              <li
                key={row.entryId}
                className="grid grid-cols-[40px_1fr_60px] items-center gap-3 border-b border-ink-700 px-4 py-2 text-sm last:border-0"
              >
                <span
                  className={
                    row.rank === 1
                      ? 'font-mono text-gold-400'
                      : 'font-mono text-paper-dim'
                  }
                >
                  {String(row.rank).padStart(2, '0')}
                </span>
                <span className="truncate">{row.displayName}</span>
                <span
                  className={
                    row.rank === 1
                      ? 'text-right font-mono text-gold-400'
                      : 'text-right font-mono'
                  }
                >
                  {row.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
