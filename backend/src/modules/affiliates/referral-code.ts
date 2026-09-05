import { randomBytes } from 'node:crypto';

// Short, unambiguous code an affiliate shares to recruit others. Uppercase base32-ish
// alphabet with I/O/0/1 removed so a code read aloud or off a screenshot round-trips.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Shared by admin-provisioned creation and self-registration.
 *
 * It lives here rather than in affiliate.service because auth.service needs it too:
 * a self-registered affiliate used to be written with no referral code at all, which
 * left their Referral Program page with nothing to share — every account gets one now,
 * from this one implementation.
 */
export function generateReferralCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
