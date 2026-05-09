/**
 * Route guard: redirects to /login if the user isn't signed in.
 *
 * While auth status is still 'loading' (we're probing /api/auth/me on boot),
 * we render a brief placeholder to avoid flashing the login screen for
 * already-signed-in users.
 */

import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

export function RequireAuth({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { status, isAdmin } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center font-mono text-xs uppercase tracking-widest text-paper-faint">
        Checking sign-in…
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <div className="font-display text-2xl tracking-wider text-gold-400">Admins only</div>
        <div className="text-sm text-paper-dim">
          This area is restricted. If you should have access, ask Brett to add your email to the admin
          list.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
