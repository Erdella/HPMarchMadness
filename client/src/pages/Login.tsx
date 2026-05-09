/**
 * Login screen — magic-link request.
 *
 * Three states:
 *   - idle:    enter email
 *   - sending: request in flight
 *   - sent:    "check your inbox" affirmation, with option to send to a
 *              different email
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { useConfig } from '../lib/config';

export function Login() {
  const { signIn } = useAuth();
  const config = useConfig();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setError(null);
    try {
      await signIn(email.trim().toLowerCase());
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-10">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">
          {config.annualNumber}th annual · {config.year}
        </span>
        <h1 className="font-display text-3xl tracking-wider text-gold-400">Sign in</h1>
        <p className="text-sm text-paper-dim">
          Enter the email you used to enter the pool. We'll send you a one-time sign-in link.
        </p>
      </header>

      {status === 'sent' ? (
        <div className="card">
          <div className="font-display text-lg tracking-wider text-gold-400">Check your inbox</div>
          <p className="mt-2 text-sm text-paper-dim">
            We sent a sign-in link to <span className="font-mono text-paper">{email}</span>. It expires
            in 15 minutes. Click the button in the email to come back signed in.
          </p>
          <button
            type="button"
            className="btn-secondary mt-4"
            onClick={() => {
              setStatus('idle');
              setEmail('');
            }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'sending'}
            />
          </label>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button type="submit" className="btn-primary" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      )}

      <section className="space-y-3 border-t border-ink-700 pt-6 text-sm text-paper-dim">
        <h2 className="font-display text-base tracking-wider text-gold-400">{config.aboutHenry.heading}</h2>
        {config.aboutHenry.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </section>
    </div>
  );
}
