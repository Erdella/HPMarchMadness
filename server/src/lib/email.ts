/**
 * Email delivery via Resend.
 *
 * Kept thin on purpose — one wrapper per email type, so swapping providers
 * later (or adding HTML templates) only touches this file.
 *
 * Free tier: 100 emails/day, 3000/month. More than enough for a bracket pool.
 */

import { Resend } from 'resend';
import type { Env } from './env.js';

let client: Resend | null = null;

function getClient(env: Env): Resend {
  if (!client) {
    client = new Resend(env.RESEND_API_KEY);
  }
  return client;
}

export interface MagicLinkEmailOptions {
  to: string;
  magicLinkUrl: string;
  expiresInMinutes: number;
}

/**
 * Send a magic-link sign-in email. The URL is single-use and expires.
 * In dev, when RESEND_API_KEY starts with "re_test_" or NODE_ENV !== 'production',
 * the link is also printed to the server log so you can copy/paste it without
 * waiting for delivery.
 */
export async function sendMagicLinkEmail(env: Env, opts: MagicLinkEmailOptions): Promise<void> {
  const { to, magicLinkUrl, expiresInMinutes } = opts;

  if (env.NODE_ENV !== 'production') {
    // Convenience: surface the link in the server log during local dev.
    console.log(`\n  ➜ Magic link for ${to}:\n    ${magicLinkUrl}\n`);
  }

  const subject = "Sign in to Henry Pearson's March Madness";
  const text = [
    `Click this link to sign in (it expires in ${expiresInMinutes} minutes):`,
    '',
    magicLinkUrl,
    '',
    "If you didn't request this, you can ignore this email.",
    '',
    '— HP March Madness',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <div style="border-left: 4px solid #FFC627; padding: 4px 0 4px 16px; margin-bottom: 24px;">
        <div style="font-size: 11px; letter-spacing: 2px; color: #8C1D40; font-weight: 600;">HP MARCH MADNESS</div>
        <div style="font-size: 22px; font-weight: 600; margin-top: 4px;">Sign in</div>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">Click the button below to sign in. This link expires in ${expiresInMinutes} minutes and can only be used once.</p>
      <p style="margin: 28px 0;">
        <a href="${magicLinkUrl}" style="display: inline-block; background: #8C1D40; color: #FFC627; text-decoration: none; padding: 12px 22px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px;">Sign in &rarr;</a>
      </p>
      <p style="font-size: 13px; color: #666; line-height: 1.6;">If the button doesn't work, paste this into your browser:<br/><span style="color: #333; word-break: break-all;">${magicLinkUrl}</span></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
      <p style="font-size: 12px; color: #888;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  const { error } = await getClient(env).emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(`Failed to send magic-link email: ${error.message ?? 'unknown'}`);
  }
}
