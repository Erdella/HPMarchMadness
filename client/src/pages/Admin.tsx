/**
 * Admin.
 *
 * STUB: M4 ships only the placeholder. M5 fills in: results entry per game,
 * lock/unlock submissions toggle, payment-status dashboard.
 */

export function Admin() {
  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">Admin</span>
        <h1 className="font-display text-3xl tracking-wider text-gold-400">Tournament controls</h1>
        <p className="text-sm text-paper-dim">
          Record game winners, lock and unlock submissions, mark payments received.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-400">
            Submissions
          </div>
          <div className="mt-1 font-display text-2xl tracking-wider">—</div>
          <div className="text-xs text-paper-faint">Lock / unlock controls land in M5.</div>
        </div>
        <div className="card">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-400">Results</div>
          <div className="mt-1 font-display text-2xl tracking-wider">0 / 63</div>
          <div className="text-xs text-paper-faint">Game-by-game winner entry lands in M5.</div>
        </div>
        <div className="card">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-400">
            Payments
          </div>
          <div className="mt-1 font-display text-2xl tracking-wider">—</div>
          <div className="text-xs text-paper-faint">Payment status dashboard lands in M5.</div>
        </div>
      </div>
    </div>
  );
}
