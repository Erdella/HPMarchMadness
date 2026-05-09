/**
 * /auth/landing — destination of the magic-link redirect.
 *
 * The server redirects here with the JWT in the URL fragment:
 *     https://hpmarchmadness.org/auth/landing#session=eyJ...
 *
 * We read the fragment, hand it off to AuthProvider via acceptToken(), then
 * strip the fragment from the URL via history.replaceState before redirecting
 * to /draft (or wherever the user was originally trying to go).
 */

import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function AuthLanding() {
  const { acceptToken, status } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const token = params.get('session');

    if (!token) {
      setError('No session token in the URL. The link may have been opened wrong.');
      return;
    }

    // Strip the token from the address bar before doing anything else.
    history.replaceState(null, '', window.location.pathname + window.location.search);

    acceptToken(token).catch((err: Error) => {
      setError(err.message);
    });
  }, [acceptToken]);

  if (status === 'authenticated') {
    return <Navigate to="/draft" replace />;
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
        <div className="font-display text-2xl tracking-wider text-gold-400">Sign-in failed</div>
        <div className="text-sm text-paper-dim">{error}</div>
        <a href="/login" className="btn-secondary mt-2">
          Back to sign-in
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center font-mono text-xs uppercase tracking-widest text-paper-faint">
      Signing you in…
    </div>
  );
}
