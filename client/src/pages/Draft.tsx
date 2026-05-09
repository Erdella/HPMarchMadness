/**
 * Draft / bracket-builder.
 *
 * STUB: Milestone 4 ships only the placeholder. Milestone 5 fills in the
 * full 64-team picker grid, bucket counters, region tabs, and submit flow.
 */

import { useConfig } from '../lib/config';

export function Draft() {
  const config = useConfig();

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">Bracket draft</span>
        <h1 className="font-display text-3xl tracking-wider text-gold-400">Pick your {config.totalPicksRequired}</h1>
        <p className="text-sm text-paper-dim">
          Distribute your picks across the seed buckets. You can submit until the deadline; up to then
          your picks are editable.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-5">
        {config.seedBuckets.map((bucket) => (
          <div key={bucket.id} className="card">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gold-400">
              {bucket.label}
            </div>
            <div className="mt-1 font-display text-2xl tracking-wider">0 / {bucket.pickCount}</div>
            <div className="mt-1 text-xs text-paper-faint">Seeds {bucket.seeds.join(', ')}</div>
          </div>
        ))}
      </div>

      <div className="card border-gold-400/40 text-sm text-paper-dim">
        <div className="font-mono text-[10px] uppercase tracking-widest text-gold-400">Coming next</div>
        <p className="mt-1">
          The team grid, region tabs, and submit form land in Milestone 5. Buckets, scoring rules, and
          payment options are already wired in from <span className="font-mono">/api/config</span>.
        </p>
      </div>
    </div>
  );
}
