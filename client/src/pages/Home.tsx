/**
 * Home / dashboard — first thing a signed-in user sees.
 *
 * Quick summary of where they stand: did they submit yet, are submissions
 * still open, deep links to draft / leaderboard, and the rules + memorial
 * blurb in the same view.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useConfig } from '../lib/config';

export function Home() {
  const { user } = useAuth();
  const config = useConfig();

  return (
    <div className="flex flex-col gap-8 py-2">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">
          welcome, {user?.email.split('@')[0]}
        </span>
        <h1 className="font-display text-4xl tracking-wider text-gold-400">
          {config.annualNumber}TH ANNUAL
        </h1>
        <p className="max-w-xl text-sm text-paper-dim">{config.tagline}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/draft"
          className="card group flex flex-col gap-2 transition-colors hover:border-gold-400/50 hover:bg-ink-700"
        >
          <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">Step 1</span>
          <span className="font-display text-2xl tracking-wider">Draft your bracket →</span>
          <span className="text-sm text-paper-dim">
            Pick {config.totalPicksRequired} teams across the seed buckets. ${(config.fee.entryCents / 100).toFixed(0)} per entry.
          </span>
        </Link>

        <Link
          to="/leaderboard"
          className="card group flex flex-col gap-2 transition-colors hover:border-gold-400/50 hover:bg-ink-700"
        >
          <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">Live</span>
          <span className="font-display text-2xl tracking-wider">Leaderboard →</span>
          <span className="text-sm text-paper-dim">
            Standings update as the admin records each game's winner.
          </span>
        </Link>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg tracking-wider text-gold-400">How to play</h2>
        <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-paper-dim">
          {config.howToPlay.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg tracking-wider text-gold-400">{config.aboutHenry.heading}</h2>
        {config.aboutHenry.body.map((para, i) => (
          <p key={i} className="text-sm text-paper-dim">
            {para}
          </p>
        ))}
        <p className="text-sm">
          <a
            href={config.donationRecipient.url}
            target="_blank"
            rel="noreferrer"
            className="text-gold-400 hover:underline"
          >
            Learn more about {config.donationRecipient.name} →
          </a>
        </p>
      </section>
    </div>
  );
}
