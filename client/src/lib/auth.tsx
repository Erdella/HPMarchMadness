/**
 * Auth context.
 *
 * Wraps the app and exposes:
 *   - user, isAdmin, status ('loading' | 'authenticated' | 'anonymous')
 *   - signIn(email)  → POST /api/auth/request-link
 *   - signOut()      → clear token, hit /api/auth/logout
 *   - acceptToken(token) → used by AuthLanding when reading session= from URL hash
 *
 * On first mount, if a token is in localStorage, we probe /api/auth/me. A
 * 401 silently clears the token and falls back to anonymous — common after
 * 30 days when the JWT expires.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiFetch,
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from './api';

export interface CurrentUser {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  isAdmin: boolean;
  /** Send a magic link. Resolves on the request being accepted, not on click-through. */
  signIn(email: string): Promise<void>;
  /** Clear local session and hit logout endpoint. */
  signOut(): Promise<void>;
  /** Used by /auth/landing to consume a token from the URL hash. */
  acceptToken(token: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface MeResponse {
  user: CurrentUser;
  isAdmin: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const refresh = useCallback(async (): Promise<boolean> => {
    const token = getSessionToken();
    if (!token) {
      setUser(null);
      setIsAdmin(false);
      setStatus('anonymous');
      return false;
    }
    try {
      const me = await apiFetch<MeResponse>('/api/auth/me', { silentOn401: true });
      setUser(me.user);
      setIsAdmin(me.isAdmin);
      setStatus('authenticated');
      return true;
    } catch {
      clearSessionToken();
      setUser(null);
      setIsAdmin(false);
      setStatus('anonymous');
      return false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string) => {
    const next = `${window.location.origin}/auth/landing`;
    await apiFetch('/api/auth/request-link', {
      method: 'POST',
      body: { email, next },
      unauthenticated: true,
    });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* not fatal */
    }
    clearSessionToken();
    setUser(null);
    setIsAdmin(false);
    setStatus('anonymous');
  }, []);

  const acceptToken = useCallback(
    async (token: string) => {
      setSessionToken(token);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, isAdmin, signIn, signOut, acceptToken }),
    [status, user, isAdmin, signIn, signOut, acceptToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
