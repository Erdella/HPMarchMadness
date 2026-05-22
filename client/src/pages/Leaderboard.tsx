/**
 * Leaderboard.
 *
 * Per-row layout (two visual rows per entry):
 *   1. Rank · name · per-round breakdown · total
 *   2. The entry's 15 picks rendered as compact pills, with eliminated teams
 *      grayed-out and struck through.
 *
 * Live data — refetches on year change. Top-3 ranks are accented.
 */

import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';
import { useConfig } from '../lib/config';
import type { StandingsRow, Team } from '../lib/types';
import { useYear } from '../lib/year';

interface StandingsRowWithPicks extends StandingsRow {
  picks: string[];
}

interface LeaderboardResponse {
  year: number;
  totalEntries: number;
  eliminatedTeamIds: string[];
  standings: StandingsRowWithPicks[];
}

const ROUND_HEADERS = ['R64', 'R32', 'S16', 'E8', 'F4', 'CHIP'];

function roundLabel(round: number): string {
  return ROUND_HEADERS[round - 1] ?? `R${round}`;
}

export function Leaderboard() {
  const config = useConfig();
  const { selectedYear } = useYear();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showPicks, setShowPicks] = useState(true);

  useEffect(() => {
    if (!selectedYear) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(null);
    Promise.all([
      apiFetch<LeaderboardResponse>(`/api/leaderboard?year=${selectedYear}`),
      apiFetch<{ teams: Team[] }>(`/api/config/teams?year=${selectedYear}`),
    ])
      .then(([lb, t]) => {
        if (cancelled) return;
        setData(lb);
        setTeams(t.teams);
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
  }, [selectedYear]);

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const eliminatedSet = useMemo(
    () => new Set(data?.eliminatedTeamIds ?? []),
    [data?.eliminatedTeamIds],
  );

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
        Scoring:{' '}
        {Object.entries(config.scoring)
          .map(([r, p]) => `${roundLabel(Number(r))}=${p}`)
          .join(' · ')}
        . Ties broken by 1st-round points, then 2nd, then onward.
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
          No entries for {data.year} yet.
        </div>
      )}

      {data && data.standings.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input max-w-xs"
              placeholder="Filter by name…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-paper-dim">
              <input
                type="checkbox"
                checked={showPicks}
                onChange={(e) => setShowPicks(e.target.checked)}
              />
              Show picks
            </label>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-paper-faint">
              {eliminatedSet.size} eliminated · {teams.length - eliminatedSet.size} alive
            </span>
          </div>

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
                    <Row
                      key={row.entryId}
                      row={row}
                      teamMap={teamMap}
                      eliminatedSet={eliminatedSet}
                      rankClass={rankClass}
                      top={top}
                      showPicks={showPicks}
                    />
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

function Row({
  row,
  teamMap,
  eliminatedSet,
  rankClass,
  top,
  showPicks,
}: {
  row: StandingsRowWithPicks;
  teamMap: ReadonlyMap<string, Team>;
  eliminatedSet: ReadonlySet<string>;
  rankClass: string;
  top: boolean;
  showPicks: boolean;
}) {
  // Sort picks by seed for stable display.
  const sortedPicks = useMemo(() => {
    return [...row.picks].sort((a, b) => {
      const ta = teamMap.get(a);
      const tb = teamMap.get(b);
      const sa = ta?.seed ?? 99;
      const sb = tb?.seed ?? 99;
      if (sa !== sb) return sa - sb;
      return (ta?.name ?? '').localeCompare(tb?.name ?? '');
    });
  }, [row.picks, teamMap]);

  return (
    <>
      <tr className="border-b border-ink-700/50">
        <td className={`px-4 py-2 font-mono ${rankClass}`}>{String(row.rank).padStart(2, '0')}</td>
        <td className="px-4 py-2">
          <span className={top ? 'font-medium text-gold-400' : ''}>{row.displayName}</span>
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
          className={`px-4 py-2 text-right font-mono ${top ? 'text-gold-400' : 'text-paper'}`}
        >
          {row.total}
        </td>
      </tr>
      {showPicks && (
        <tr className="border-b border-ink-700">
          <td />
          <td colSpan={8} className="px-4 pb-3 pt-0">
            <ul className="flex flex-wrap gap-1.5">
              {sortedPicks.map((id) => {
                const team = teamMap.get(id);
                const alive = team && !eliminatedSet.has(id);
                return (
                  <li
                    key={id}
                    className={
                      'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ' +
                      (alive
                        ? 'border-ink-700 bg-ink-800 text-paper'
                        : 'border-ink-700/50 bg-ink-800/40 text-paper-faint line-through')
                    }
                    title={team ? `${team.name} (${team.region}, seed ${team.seed})` : id}
                  >
                    <span
                      className={
                        alive ? 'text-gold-400' : 'text-paper-faint'
                      }
                    >
                      {team?.seed ?? '?'}
                    </span>
                    <span>{team?.name ?? id}</span>
                  </li>
                );
              })}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
