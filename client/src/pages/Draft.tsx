/**
 * Draft / bracket-builder.
 *
 * Flow:
 *   1. On mount, fetch /api/config/teams + /api/admin/settings (best-effort)
 *      and /api/entries/me.
 *   2. Show "your entries" list at top (with edit/delete buttons), then a
 *      working area for either a NEW entry or editing an existing one.
 *   3. The working area is a region tab → 16-team grid + bucket counters
 *      across the top + an entry-form footer (display name, payment).
 *   4. Submit POSTs (new) or PATCHes (editing). On success, refresh `myEntries`
 *      and reset the working area.
 *
 * Multiple entries per user are explicitly supported (the Brooks/Steve
 * pattern). After submitting, we just leave the user on the page with a
 * "Submit another entry" button.
 */

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { useConfig } from '../lib/config';
import {
  allBucketsSatisfied,
  canSelectTeam,
  computeBucketCounts,
  type BucketCount,
} from '../lib/pickValidation';
import type { BracketSide, Entry, PaymentMethod, Region, Team } from '../lib/types';
import { useYear } from '../lib/year';

const REGIONS: readonly Region[] = ['South', 'West', 'Midwest', 'East'];
const SIDES: readonly BracketSide[] = ['Left', 'Right'];

/**
 * How the team picker is grouped. Both modes pick from the same 64 teams under
 * the same bucket caps; only the visible grouping changes. "region" is the
 * traditional layout (one region tab at a time). "seed" lets you draft across
 * regions one bucket at a time — handy if you tend to think "give me my four
 * #1 seeds first" rather than "fill out the South first."
 */
type DraftMode = 'region' | 'seed';

export function Draft() {
  const config = useConfig();
  const { selectedYear, isViewingHistory } = useYear();
  const [searchParams, setSearchParams] = useSearchParams();
  const entryParam = searchParams.get('entry');

  const [teams, setTeams] = useState<Team[]>([]);
  const [myEntries, setMyEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsClosed, setSubmissionsClosed] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<Region>('South');
  const [mode, setMode] = useState<DraftMode>('region');
  // Seeded from the first bucket once config has loaded. We initialize lazily
  // so the very first render doesn't end up with an empty active id that
  // momentarily filters to zero teams.
  const [activeBucketId, setActiveBucketId] = useState<string>(
    () => config.seedBuckets[0]?.id ?? '',
  );
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [displayName, setDisplayName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('venmo');
  const [paymentMethodNote, setPaymentMethodNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Boot — refetches when the selected year changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedYear) return;
    let cancelled = false;
    setLoading(true);
    setBootError(null);
    // Clear stale state when switching years (but preserve editingId set from
    // the ?entry= query — that's handled in the follow-up effect below).
    setMyEntries([]);
    setPicks(new Set());
    setDisplayName('');
    setPaymentMethodNote('');
    setJustSavedId(null);

    Promise.all([
      apiFetch<{ teams: Team[] }>(`/api/config/teams?year=${selectedYear}`),
      apiFetch<{ entries: Entry[] }>(`/api/entries/me?year=${selectedYear}`),
    ])
      .then(([t, e]) => {
        if (cancelled) return;
        setTeams(t.teams);
        setMyEntries(e.entries);
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
  }, [selectedYear]);

  // -------------------------------------------------------------------------
  // Deep-link: load a specific entry by ?entry=<id>
  //
  // Used by the Admin "Edit picks" button. The server's PATCH /api/entries/:id
  // already permits admins to edit any entry, so we just fetch and load.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!entryParam) return;
    let cancelled = false;
    apiFetch<{ entry: Entry }>(`/api/entries/${entryParam}`)
      .then(({ entry }) => {
        if (cancelled) return;
        setEditingId(entry.id);
        setPicks(new Set(entry.picks));
        setDisplayName(entry.displayName);
        setPaymentMethod(entry.paymentMethod);
        setPaymentMethodNote(entry.paymentMethodNote ?? '');
        setJustSavedId(null);
        setSubmitError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        setBootError(`Couldn't load entry ${entryParam}: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [entryParam]);

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------
  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const bucketCounts = useMemo(
    () => computeBucketCounts(picks, teamMap, config.seedBuckets),
    [picks, teamMap, config.seedBuckets],
  );

  // Which teams the picker is currently showing. In region mode this is just
  // the four-seed-per-region slice we've always had; in seed mode it's all
  // teams from the active bucket (4, 8, 16, 16, or 20 teams) across regions.
  // Declared up here (not next to the JSX) so the hook order stays stable
  // across the `if (loading) return …` early returns below.
  const activeTeams = useMemo(() => {
    if (mode === 'region') {
      return teams
        .filter((t) => t.region === activeRegion)
        .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name));
    }
    const bucket = config.seedBuckets.find((b) => b.id === activeBucketId);
    const seedSet = new Set(bucket?.seeds ?? []);
    return teams
      .filter((t) => seedSet.has(t.seed))
      .sort(
        (a, b) =>
          a.seed - b.seed ||
          a.region.localeCompare(b.region) ||
          a.name.localeCompare(b.name),
      );
  }, [mode, activeRegion, activeBucketId, teams, config.seedBuckets]);

  const canSubmit =
    !submitting &&
    !isViewingHistory &&
    displayName.trim().length > 0 &&
    allBucketsSatisfied(bucketCounts);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  function startNewEntry() {
    setEditingId(null);
    setPicks(new Set());
    setDisplayName('');
    setPaymentMethod('venmo');
    setPaymentMethodNote('');
    setSubmitError(null);
    setJustSavedId(null);
    // If we arrived via /draft?entry=…, clear the param so subsequent
    // refreshes don't re-load the same entry.
    if (entryParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('entry');
      setSearchParams(next, { replace: true });
    }
  }

  function editEntry(entry: Entry) {
    setEditingId(entry.id);
    setPicks(new Set(entry.picks));
    setDisplayName(entry.displayName);
    setPaymentMethod(entry.paymentMethod);
    setPaymentMethodNote(entry.paymentMethodNote ?? '');
    setSubmitError(null);
    setJustSavedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteEntry(entry: Entry) {
    if (!confirm(`Delete entry "${entry.displayName}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
      setMyEntries((prev) => prev.filter((e) => e.id !== entry.id));
      if (editingId === entry.id) startNewEntry();
    } catch (err) {
      alert(`Couldn't delete: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  function togglePick(team: Team) {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(team.id)) {
        next.delete(team.id);
      } else if (canSelectTeam(team, prev, bucketCounts, config.seedBuckets)) {
        next.add(team.id);
      }
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        displayName: displayName.trim(),
        picks: [...picks],
        paymentMethod,
        paymentMethodNote: paymentMethodNote.trim() || null,
      };
      let saved: Entry;
      if (editingId) {
        const res = await apiFetch<{ entry: Entry }>(`/api/entries/${editingId}`, {
          method: 'PATCH',
          body: payload,
        });
        saved = res.entry;
        setMyEntries((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      } else {
        const res = await apiFetch<{ entry: Entry }>('/api/entries', {
          method: 'POST',
          body: payload,
        });
        saved = res.entry;
        setMyEntries((prev) => [saved, ...prev]);
      }
      setJustSavedId(saved.id);
      setEditingId(null);
      // Don't reset the form — leave it visible so the user sees confirmation.
      // They can click "Start a new entry" to reset.
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === 'submissions_closed') {
        setSubmissionsClosed(true);
        setSubmitError('Submissions are closed for this year.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="font-mono text-xs uppercase tracking-widest text-paper-faint">
        Loading bracket…
      </div>
    );
  }
  if (bootError) {
    return (
      <div className="card border-red-400/40 text-sm text-red-400">
        Couldn't load bracket: {bootError}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">
          Bracket draft · {config.year}
        </span>
        <h1 className="font-display text-3xl tracking-wider text-gold-400">Pick your {config.totalPicksRequired}</h1>
        <p className="max-w-2xl text-sm text-paper-dim">
          Distribute {config.totalPicksRequired} picks across the seed buckets.
          {' '}${(config.fee.entryCents / 100).toFixed(0)} per entry, ${(config.fee.donationPerEntryCents / 100).toFixed(0)} of which goes to{' '}
          <a
            className="text-gold-400 hover:underline"
            href={config.donationRecipient.url}
            target="_blank"
            rel="noreferrer"
          >
            {config.donationRecipient.name}
          </a>{' '}
          {config.donationRecipient.context}.
        </p>
      </header>

      {submissionsClosed && (
        <div className="card border-red-400/40 text-sm text-red-400">
          Submissions are closed. Existing entries are locked.
        </div>
      )}

      {isViewingHistory && (
        <div className="card border-gold-400/40 text-sm text-paper-dim">
          You're viewing <span className="font-mono text-gold-400">{selectedYear}</span> as
          history. Submit and edit are disabled. Switch to the current year in the header to
          make changes.
        </div>
      )}

      <YourEntries
        entries={myEntries}
        editingId={editingId}
        justSavedId={justSavedId}
        buckets={config.seedBuckets}
        onEdit={editEntry}
        onDelete={deleteEntry}
        onStartNew={startNewEntry}
      />

      <BucketStrip counts={bucketCounts} buckets={config.seedBuckets} />

      <BracketBalance
        picks={picks}
        teamMap={teamMap}
        teams={teams}
        totalRequired={config.totalPicksRequired}
      />

      <ModeToggle mode={mode} onChange={setMode} />

      {mode === 'region' ? (
        <RegionTabs active={activeRegion} onChange={setActiveRegion} />
      ) : (
        <SeedBucketTabs
          buckets={config.seedBuckets}
          active={activeBucketId}
          onChange={setActiveBucketId}
        />
      )}

      <TeamGrid
        teams={activeTeams}
        picks={picks}
        bucketCounts={bucketCounts}
        buckets={config.seedBuckets}
        showRegion={mode === 'seed'}
        onToggle={togglePick}
      />

      <form className="card flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
              Entry name
            </span>
            <input
              required
              maxLength={120}
              className="input"
              placeholder="Your name (or whoever this entry is for)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
            />
            <span className="text-xs text-paper-faint">
              You can submit multiple entries. Use a different name for each.
            </span>
          </label>

          <label className="flex flex-col gap-1 sm:w-48">
            <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
              Payment method
            </span>
            <select
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              disabled={submitting}
            >
              {config.paymentOptions.map((opt) => (
                <option key={opt.method} value={opt.method}>
                  {opt.label}
                  {opt.preferred ? ' (preferred)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <PaymentDetail method={paymentMethod} options={config.paymentOptions} />

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
            Note (optional)
          </span>
          <input
            className="input"
            placeholder="e.g. Venmo handle, special arrangement, etc."
            value={paymentMethodNote}
            onChange={(e) => setPaymentMethodNote(e.target.value)}
            disabled={submitting}
            maxLength={500}
          />
        </label>

        {submitError && <div className="text-sm text-red-400">{submitError}</div>}
        {justSavedId && !submitError && (
          <div className="text-sm text-gold-400">
            ✓ Entry saved.{' '}
            <button
              type="button"
              className="underline hover:text-gold-300"
              onClick={startNewEntry}
            >
              Submit another entry
            </button>
            .
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-paper-faint">
            {picks.size} / {config.totalPicksRequired} picks
          </span>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {submitting ? 'Saving…' : editingId ? 'Update entry' : 'Submit entry'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — kept in this file to keep the milestone delivery contained.
// ---------------------------------------------------------------------------

function YourEntries({
  entries,
  editingId,
  justSavedId,
  buckets,
  onEdit,
  onDelete,
  onStartNew,
}: {
  entries: Entry[];
  editingId: string | null;
  justSavedId: string | null;
  buckets: readonly { id: string; label: string; seeds: number[]; pickCount: number }[];
  onEdit(entry: Entry): void;
  onDelete(entry: Entry): void;
  onStartNew(): void;
}) {
  if (entries.length === 0) {
    return (
      <div className="card flex items-center justify-between gap-3">
        <span className="text-sm text-paper-dim">
          You haven't submitted an entry yet — pick {buckets.reduce((n, b) => n + b.pickCount, 0)} teams below.
        </span>
      </div>
    );
  }
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg tracking-wider text-gold-400">Your entries</h2>
        <button type="button" className="btn-secondary text-xs" onClick={onStartNew}>
          + Submit another
        </button>
      </div>
      <ul className="flex flex-col divide-y divide-ink-700">
        {entries.map((entry) => {
          const isEditing = editingId === entry.id;
          const justSaved = justSavedId === entry.id;
          return (
            <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex-1 truncate font-medium">
                {entry.displayName}
                {isEditing && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-gold-400">
                    editing
                  </span>
                )}
                {justSaved && !isEditing && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-gold-400">
                    just saved
                  </span>
                )}
              </span>
              <span className="font-mono text-[11px] text-paper-faint">
                {entry.picks.length} picks
              </span>
              <button
                type="button"
                className="text-xs text-paper-dim hover:text-gold-400"
                onClick={() => onEdit(entry)}
                disabled={isEditing}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-xs text-paper-dim hover:text-red-400"
                onClick={() => onDelete(entry)}
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BucketStrip({
  counts,
  buckets,
}: {
  counts: readonly BucketCount[];
  buckets: readonly { id: string; label: string; pickCount: number; seeds: number[] }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {buckets.map((bucket) => {
        const c = counts.find((x) => x.bucketId === bucket.id);
        const current = c?.current ?? 0;
        const required = bucket.pickCount;
        const state =
          c?.over ? 'over' : c?.full ? 'done' : current > 0 ? 'progress' : 'empty';
        const stateClass = {
          empty: 'border-ink-700 text-paper-dim',
          progress: 'border-gold-700/40 text-paper',
          done: 'border-gold-400 text-gold-400',
          over: 'border-red-400 text-red-400',
        }[state];
        return (
          <div key={bucket.id} className={`card border-2 ${stateClass}`}>
            <div className="font-mono text-[10px] uppercase tracking-widest">{bucket.label}</div>
            <div className="mt-1 font-display text-2xl tracking-wider">
              {current} / {required}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RegionTabs({
  active,
  onChange,
}: {
  active: Region;
  onChange(region: Region): void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-ink-700 pb-2">
      {REGIONS.map((region) => (
        <button
          key={region}
          type="button"
          className={
            'rounded-sm px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors ' +
            (active === region
              ? 'bg-maroon-500 text-gold-400'
              : 'border border-ink-700 text-paper-dim hover:bg-ink-700')
          }
          onClick={() => onChange(region)}
        >
          {region}
        </button>
      ))}
    </div>
  );
}

function TeamGrid({
  teams,
  picks,
  bucketCounts,
  buckets,
  showRegion,
  onToggle,
}: {
  teams: Team[];
  picks: ReadonlySet<string>;
  bucketCounts: readonly BucketCount[];
  buckets: readonly { id: string; label: string; seeds: number[]; pickCount: number }[];
  // True when teams from multiple regions are being displayed together (seed
  // mode), so each card needs a region badge to keep structural context.
  showRegion: boolean;
  onToggle(team: Team): void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {teams.map((team) => {
        const selected = picks.has(team.id);
        const blocked = !selected && !canSelectTeam(team, picks, bucketCounts, buckets);
        const cls = selected
          ? 'border-gold-400 bg-maroon-500 text-gold-400'
          : blocked
            ? 'border-ink-700 bg-ink-800 text-paper-faint cursor-not-allowed'
            : 'border-ink-700 bg-ink-800 text-paper hover:border-gold-400/40 hover:bg-ink-700';
        return (
          <button
            key={team.id}
            type="button"
            disabled={blocked}
            onClick={() => onToggle(team)}
            className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm transition-colors ${cls}`}
          >
            <span className="font-mono text-[10px] tracking-widest text-paper-faint">
              {String(team.seed).padStart(2, '0')}
            </span>
            {showRegion && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
                {team.region.slice(0, 3)}
              </span>
            )}
            <span className="flex-1 truncate font-medium">{team.name}</span>
            {selected && <span className="font-mono text-[10px]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: DraftMode;
  onChange(mode: DraftMode): void;
}) {
  const options: readonly { id: DraftMode; label: string }[] = [
    { id: 'region', label: 'Region' },
    { id: 'seed', label: 'Seed' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
        Browse by:
      </span>
      <div className="inline-flex overflow-hidden rounded-sm border border-ink-700">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={
              'px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors ' +
              (mode === opt.id
                ? 'bg-maroon-500 text-gold-400'
                : 'text-paper-dim hover:bg-ink-700')
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SeedBucketTabs({
  buckets,
  active,
  onChange,
}: {
  buckets: readonly { id: string; label: string; seeds: number[]; pickCount: number }[];
  active: string;
  onChange(id: string): void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-ink-700 pb-2">
      {buckets.map((bucket) => (
        <button
          key={bucket.id}
          type="button"
          className={
            'rounded-sm px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors ' +
            (active === bucket.id
              ? 'bg-maroon-500 text-gold-400'
              : 'border border-ink-700 text-paper-dim hover:bg-ink-700')
          }
          onClick={() => onChange(bucket.id)}
        >
          {bucket.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Bracket Balance — a quick visual check for one-sided drafting.
 *
 * Shows pick counts on each half of the bracket (Left / Right) and per region,
 * with maroon callouts when distributions get noticeably skewed:
 *   - Side warning fires at ≥65% of total picks on one side (≥10 of 15).
 *   - Region warning fires at ≥40% of total picks in one region (≥6 of 15).
 *
 * Thresholds scale with totalRequired so any future change to the pool format
 * (e.g. dropping to 12 picks) doesn't silently break the panel.
 *
 * Hidden until the user makes their first pick so an empty bracket doesn't
 * scream a warning.
 */
function BracketBalance({
  picks,
  teamMap,
  teams,
  totalRequired,
}: {
  picks: ReadonlySet<string>;
  teamMap: ReadonlyMap<string, Team>;
  teams: readonly Team[];
  totalRequired: number;
}) {
  // Map each side → the regions assigned to that side this year. Stored in
  // bracket config (varies year-to-year), so we derive it from the team list
  // rather than hardcoding.
  const sideRegions = useMemo(() => {
    const m: Record<BracketSide, Region[]> = { Left: [], Right: [] };
    const seen = new Set<string>();
    for (const t of teams) {
      const key = `${t.side}-${t.region}`;
      if (seen.has(key)) continue;
      seen.add(key);
      m[t.side].push(t.region);
    }
    return m;
  }, [teams]);

  const { regionCounts, sideCounts } = useMemo(() => {
    const region: Record<Region, number> = { South: 0, West: 0, Midwest: 0, East: 0 };
    const side: Record<BracketSide, number> = { Left: 0, Right: 0 };
    for (const id of picks) {
      const t = teamMap.get(id);
      if (!t) continue;
      region[t.region] += 1;
      side[t.side] += 1;
    }
    return { regionCounts: region, sideCounts: side };
  }, [picks, teamMap]);

  if (picks.size === 0) return null;

  const regionWarnAt = Math.max(2, Math.ceil(totalRequired * 0.4)); // 6 of 15
  const sideWarnAt = Math.max(2, Math.ceil(totalRequired * 0.65)); // 10 of 15

  const heavySide: BracketSide | null =
    sideCounts.Left >= sideWarnAt
      ? 'Left'
      : sideCounts.Right >= sideWarnAt
        ? 'Right'
        : null;

  // Region with the highest count, only flagged if at or above the threshold.
  const topRegion = REGIONS.reduce<{ region: Region; count: number } | null>(
    (acc, r) => {
      const count = regionCounts[r];
      if (!acc || count > acc.count) return { region: r, count };
      return acc;
    },
    null,
  );
  const heavyRegion = topRegion && topRegion.count >= regionWarnAt ? topRegion : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">
          Bracket balance
        </span>
        <p className="text-xs text-paper-dim">
          A quick visual check for one-sided drafting.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SIDES.map((s) => (
          <div key={s} className="card flex flex-col gap-0.5 py-3">
            <span className="font-display text-3xl tracking-wider text-gold-400">
              {sideCounts[s]}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-paper-dim">
              {s} side picks
            </span>
          </div>
        ))}
      </div>

      {heavySide && (
        <div className="card border-maroon-400/40 text-sm text-paper-dim">
          <span className="font-medium text-maroon-300">
            Heavy {heavySide.toLowerCase()}-side stack.
          </span>{' '}
          Your picks are concentrated in the{' '}
          <span className="text-paper">{sideRegions[heavySide].join('/')}</span>{' '}
          half of the bracket.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {REGIONS.map((r) => {
          const n = regionCounts[r];
          const heavy = n >= regionWarnAt;
          return (
            <div
              key={r}
              className={
                'card flex items-center justify-between py-3 ' +
                (heavy ? 'border-maroon-400/60' : '')
              }
            >
              <span className="text-sm text-paper">{r}</span>
              <span
                className={
                  'font-display text-2xl tracking-wider ' +
                  (heavy ? 'text-maroon-300' : 'text-gold-400')
                }
              >
                {n}
              </span>
            </div>
          );
        })}
      </div>

      {heavyRegion && (
        <div className="card border-maroon-400/40 text-sm text-paper-dim">
          <span className="font-medium text-maroon-300">Heavy regional concentration.</span>{' '}
          Your picks are consolidated most heavily in{' '}
          <span className="text-paper">{heavyRegion.region}</span> with{' '}
          {heavyRegion.count} teams. If that region breaks badly, a large share
          of your bracket value could disappear quickly.
        </div>
      )}
    </section>
  );
}

function PaymentDetail({
  method,
  options,
}: {
  method: PaymentMethod;
  options: readonly { method: PaymentMethod; detail: string }[];
}) {
  const opt = options.find((o) => o.method === method);
  if (!opt) return null;
  return (
    <div className="rounded-sm border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-paper-dim">
      {opt.detail}
    </div>
  );
}
