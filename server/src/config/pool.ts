/**
 * Canonical pool configuration and copy.
 *
 * This is the single source of truth for the rules, fees, deadline, and
 * memorial copy. The frontend pulls it from GET /api/config so any change
 * here propagates without a redeploy of the client.
 *
 * IMPORTANT: this file replaces what used to live as scattered constants in
 * the original index.html. When updating year-over-year, edit ONE place.
 */

import type { PaymentMethod } from '../db/schema.js';

export const POOL_NAME = 'HP March Madness';
export const POOL_TAGLINE = "Henry Pearson's March Madness Bracket Challenge";

export const ANNUAL_NUMBER = 16; // 2026 is the 16th annual pool (started 2010).

// ---------------------------------------------------------------------------
// Scoring (points per round-win for a picked team).
// ---------------------------------------------------------------------------
export const SCORING_BY_ROUND: Record<number, number> = {
  1: 1, // First round
  2: 2, // Second round
  3: 4, // Sweet 16
  4: 6, // Elite 8
  5: 8, // Final Four
  6: 12, // Championship
};

export const ROUND_LABELS: Record<number, string> = {
  1: 'First round',
  2: 'Second round',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
};

// ---------------------------------------------------------------------------
// Bucket rules — how many picks each entry must make from each seed range.
// ---------------------------------------------------------------------------
export interface SeedBucket {
  id: string;
  label: string; // What we show participants
  seeds: number[]; // Which seeds qualify (e.g. [2, 3])
  pickCount: number; // How many picks required from this bucket
}

export const SEED_BUCKETS: readonly SeedBucket[] = [
  { id: 'b1', label: '#1 seeds', seeds: [1], pickCount: 1 },
  { id: 'b2', label: '#2–3 seeds', seeds: [2, 3], pickCount: 2 },
  { id: 'b3', label: '#4–7 seeds', seeds: [4, 5, 6, 7], pickCount: 3 },
  { id: 'b4', label: '#8–11 seeds', seeds: [8, 9, 10, 11], pickCount: 4 },
  { id: 'b5', label: '#12–16 seeds', seeds: [12, 13, 14, 15, 16], pickCount: 5 },
];

export const TOTAL_PICKS_REQUIRED = SEED_BUCKETS.reduce((n, b) => n + b.pickCount, 0); // 15

// ---------------------------------------------------------------------------
// Entry fees + donation
// ---------------------------------------------------------------------------
export const ENTRY_FEE_CENTS = 2000; // $20.00
export const DONATION_PER_ENTRY_CENTS = 200; // $2.00 to RBI per entry

export const DONATION_RECIPIENT = {
  name: 'RBI (Reviving Baseball in Inner Cities)',
  url: 'https://www.mlb.com/mlb-community/reviving-baseball-inner-cities',
  context: "in Henry Pearson's name",
} as const;

// ---------------------------------------------------------------------------
// Payment options shown to participants
// ---------------------------------------------------------------------------
export interface PaymentOption {
  method: PaymentMethod;
  label: string;
  detail: string;
  preferred?: boolean;
}

export const PAYMENT_OPTIONS: readonly PaymentOption[] = [
  {
    method: 'venmo',
    label: 'Venmo',
    detail: '@Brett-Henry-3 (last 4: 4542)',
    preferred: true,
  },
  {
    method: 'paypal',
    label: 'PayPal',
    detail: 'brett.henry@live.com — please use "personal" type so fees are not deducted',
  },
  {
    method: 'check',
    label: 'Mail a check',
    detail: '7809 NE 180th Ave, Vancouver, WA 98682',
  },
];

// ---------------------------------------------------------------------------
// Memorial copy (about Henry, why we play, why we donate)
// ---------------------------------------------------------------------------
export const ABOUT_HENRY = {
  heading: 'About Henry Pearson',
  body: [
    'Henry Pearson was an avid March Madness fan and participated in this pool before a car accident took his life far too early in 2009.',
    'He looked forward to this pool every year. In 2010, Brett Henry decided to name the tournament after him and make selections in his name. Before passing away, Henry was an aspiring sports agent focused on professional baseball players. He had a passion for baseball, and his family honors his name through the donation to RBI each year.',
    "If Henry's bracket finishes in the money, those winnings are donated to RBI as well.",
  ],
};

export const HOW_TO_PLAY = [
  '15 teams per entry, drawn from five seed buckets (1, 2–3, 4–7, 8–11, 12–16).',
  'Each round a picked team wins, you score points: 1 / 2 / 4 / 6 / 8 / 12 from first round through championship.',
  '1st, 2nd, and 3rd are determined by total points. Ties are broken by first-round points, then second-round, and so on.',
  'Entry fee is $20. $2 from each entry is donated to RBI in Henry Pearson\'s name. Fees are due by the start of the tournament.',
];

export const MEMORIAL_FOOTER = `In memory of Henry Pearson · ${ANNUAL_NUMBER}th annual`;
