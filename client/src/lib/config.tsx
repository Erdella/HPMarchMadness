/**
 * Pool config provider.
 *
 * Fetches GET /api/config once at app boot and shares it across the tree.
 * Doing it this way lets every screen render copy (memorial blurb, scoring
 * rules, payment options) without each page making its own request.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from './api';

export interface SeedBucket {
  id: string;
  label: string;
  seeds: number[];
  pickCount: number;
}

export interface PaymentOption {
  method: 'venmo' | 'paypal' | 'check' | 'other';
  label: string;
  detail: string;
  preferred?: boolean;
}

export interface AboutHenry {
  heading: string;
  body: string[];
}

export interface DonationRecipient {
  name: string;
  url: string;
  context: string;
}

export interface PoolConfig {
  poolName: string;
  tagline: string;
  annualNumber: number;
  year: number;
  scoring: Record<number, number>;
  roundLabels: Record<number, string>;
  seedBuckets: SeedBucket[];
  totalPicksRequired: number;
  fee: { entryCents: number; donationPerEntryCents: number };
  donationRecipient: DonationRecipient;
  paymentOptions: PaymentOption[];
  aboutHenry: AboutHenry;
  howToPlay: string[];
  memorialFooter: string;
}

interface ConfigContextValue {
  config: PoolConfig | null;
  loading: boolean;
  error: string | null;
}

const ConfigContext = createContext<ConfigContextValue>({ config: null, loading: true, error: null });

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<PoolConfig>('/api/config', { unauthenticated: true })
      .then((cfg) => {
        if (!cancelled) {
          setConfig(cfg);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <ConfigContext.Provider value={{ config, loading, error }}>{children}</ConfigContext.Provider>;
}

export function useConfig(): PoolConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx.config) {
    // Caller should gate on `useConfigStatus()` if they need to render before the fetch resolves.
    throw new Error('Config not loaded yet — wrap rendering in <ConfigGate> or check useConfigStatus().');
  }
  return ctx.config;
}

export function useConfigStatus() {
  const { loading, error, config } = useContext(ConfigContext);
  return { loading, error, ready: Boolean(config) };
}

/**
 * Render gate: shows children only once config is loaded. Surfaces a loading
 * state and an error state with a retry hint.
 */
export function ConfigGate({ children }: { children: ReactNode }) {
  const { loading, error, ready } = useConfigStatus();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-paper-dim">
        <div className="font-mono text-xs uppercase tracking-widest">Loading…</div>
      </div>
    );
  }
  if (error || !ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 px-4 text-center">
        <div className="font-display text-2xl tracking-wider text-gold-400">Couldn't reach the API</div>
        <div className="max-w-md text-sm text-paper-dim">
          {error ?? 'Unknown error. Check your internet connection or try again in a minute.'}
        </div>
        <button className="btn-secondary mt-2" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
