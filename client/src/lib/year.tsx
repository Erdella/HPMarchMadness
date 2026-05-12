/**
 * YearProvider — tracks which year the user is currently viewing.
 *
 * On mount: fetches /api/config/years to learn which years have data, and
 * defaults to the current TOURNAMENT_YEAR. The user can switch via the
 * header dropdown; all year-aware data fetches read `selectedYear` from
 * useYear().
 *
 * Write actions (submit entry, edit entry, enter results) are only allowed
 * when selectedYear === currentYear — see isViewingHistory.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from './api';

export interface YearInfo {
  year: number;
  hasTeams: boolean;
  hasEntries: boolean;
  hasResults: boolean;
  isCurrent: boolean;
}

interface YearsResponse {
  currentYear: number;
  years: YearInfo[];
}

interface YearContextValue {
  selectedYear: number;
  currentYear: number;
  /** True when the user is viewing a year that isn't the active tournament. */
  isViewingHistory: boolean;
  availableYears: YearInfo[];
  loading: boolean;
  setYear(year: number): void;
}

const YearContext = createContext<YearContextValue | null>(null);

export function YearProvider({ children }: { children: ReactNode }) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<YearInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<YearsResponse>('/api/config/years', { unauthenticated: true })
      .then((data) => {
        if (cancelled) return;
        setCurrentYear(data.currentYear);
        setAvailableYears(data.years);
        setSelectedYear(data.currentYear);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Don't block the whole app if this endpoint fails — fall back to
        // single-year mode by hiding the selector. We'll learn the current
        // year from /api/config (already loaded by ConfigProvider).
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<YearContextValue>(
    () => ({
      selectedYear: selectedYear ?? currentYear ?? 0,
      currentYear: currentYear ?? 0,
      isViewingHistory:
        selectedYear !== null && currentYear !== null && selectedYear !== currentYear,
      availableYears,
      loading,
      setYear: (y) => setSelectedYear(y),
    }),
    [selectedYear, currentYear, availableYears, loading],
  );

  return <YearContext.Provider value={value}>{children}</YearContext.Provider>;
}

export function useYear(): YearContextValue {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error('useYear must be used inside <YearProvider>');
  return ctx;
}
