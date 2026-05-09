/**
 * Shared types mirroring the server's API contract.
 *
 * These are duplicated rather than imported because the client and server
 * live in separate packages without monorepo tooling. Keep in sync with
 * server/src/db/schema.ts and server/src/config/teams.ts.
 */

export type PaymentMethod = 'venmo' | 'paypal' | 'check' | 'other';

export type Region = 'South' | 'West' | 'Midwest' | 'East';
export type BracketSide = 'Left' | 'Right';

export interface Team {
  id: string;
  name: string;
  seed: number;
  region: Region;
  side: BracketSide;
}

export interface FirstRoundGame {
  id: string;
  round: 0;
  region: Region;
  label: string;
  bracketLabel: string;
  participants: [string, string];
}

export interface DownstreamGame {
  id: string;
  round: 1 | 2 | 3 | 4 | 5;
  region?: Region;
  label: string;
  bracketLabel: string;
  from: [string, string];
}

export type Game = FirstRoundGame | DownstreamGame;

/** Full entry, returned to admins or to the entry's owner. */
export interface Entry {
  id: string;
  userId: string;
  year: number;
  displayName: string;
  picks: string[];
  paymentMethod: PaymentMethod;
  paymentMethodNote: string | null;
  paymentReceived: boolean;
  paymentReceivedAt: string | null;
  paymentNotes: string | null;
  submittedAt: string;
  updatedAt: string;
}

/** Redacted entry, returned to non-admins viewing other people's entries. */
export interface EntryPublic {
  id: string;
  userId: string;
  year: number;
  displayName: string;
  picks: string[];
  submittedAt: string;
}

export interface ResultRow {
  gameId: string;
  winnerTeamId: string;
  recordedAt: string;
}

export interface StandingsRow {
  entryId: string;
  displayName: string;
  total: number;
  byRound: number[];
  rank: number;
}

export interface AdminSettings {
  submissions_closed?: boolean;
  [key: string]: unknown;
}
