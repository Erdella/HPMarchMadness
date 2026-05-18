/**
 * App shell: header, content slot, footer.
 *
 * The header is intentionally compact; the focus is on whatever screen is
 * mounted inside <main>. Footer carries the memorial line ("In memory of
 * Henry Pearson · 16th annual") which is the soul of this thing.
 */

import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useConfig } from '../lib/config';
import { useYear } from '../lib/year';

export function Layout() {
  const config = useConfig();
  const { status, user, isAdmin, signOut } = useAuth();
  const { selectedYear, availableYears, setYear, isViewingHistory } = useYear();

  return (
    <div className="flex min-h-screen flex-col bg-ink-900 text-paper">
      <header className="border-b border-ink-700 bg-ink-800">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="block h-7 w-1 bg-gold-400" aria-hidden />
            <span>
              <span className="block font-display text-sm tracking-widest text-gold-400">
                HP MARCH MADNESS
              </span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-paper-faint">
                {config.annualNumber}TH ANNUAL · {config.year}
              </span>
            </span>
          </Link>

          {status === 'authenticated' && (
            <nav className="ml-auto flex items-center gap-4 text-sm">
              <NavTab to="/draft" label="Draft" />
              <NavTab to="/leaderboard" label="Leaderboard" />
              <NavTab to="/stats" label="Nerd stats" />
              {isAdmin && <NavTab to="/admin" label="Admin" />}
              {availableYears.length > 1 && (
                <YearSelector
                  selectedYear={selectedYear}
                  options={availableYears}
                  onChange={setYear}
                />
              )}
              <span className="hidden font-mono text-xs text-paper-faint sm:inline">
                {user?.email}
              </span>
              <button
                type="button"
                className="rounded-sm border border-ink-700 px-3 py-1 font-mono text-xs uppercase tracking-wider text-paper-dim transition-colors hover:bg-ink-700"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </nav>
          )}
        </div>
        {isViewingHistory && status === 'authenticated' && (
          <div className="border-t border-maroon-700 bg-maroon-700/30 px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-gold-400 sm:px-6">
            Viewing history · {selectedYear} · read-only
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-ink-700 bg-ink-800 py-4 text-center font-mono text-[11px] uppercase tracking-widest text-paper-faint">
        {config.memorialFooter} ·{' '}
        <a
          href={config.donationRecipient.url}
          target="_blank"
          rel="noreferrer"
          className="text-gold-400 hover:underline"
        >
          {config.donationRecipient.name}
        </a>
      </footer>
    </div>
  );
}

function YearSelector({
  selectedYear,
  options,
  onChange,
}: {
  selectedYear: number;
  options: { year: number; isCurrent: boolean }[];
  onChange(year: number): void;
}) {
  return (
    <select
      className="rounded-sm border border-ink-700 bg-ink-800 px-2 py-1 font-mono text-xs uppercase tracking-wider text-paper-dim transition-colors hover:bg-ink-700"
      value={selectedYear}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Select tournament year"
    >
      {options.map((opt) => (
        <option key={opt.year} value={opt.year}>
          {opt.year}
          {opt.isCurrent ? ' (live)' : ''}
        </option>
      ))}
    </select>
  );
}

function NavTab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'border-b-2 pb-1 font-mono text-xs uppercase tracking-widest transition-colors',
          isActive
            ? 'border-gold-400 text-gold-400'
            : 'border-transparent text-paper-dim hover:text-paper',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  );
}
