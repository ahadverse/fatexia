import { redirect } from 'next/navigation';

/**
 * Sign-in lives in the Affiliate portal now, not here.
 *
 * Kept as a redirect rather than deleted: `/login` is linked from the navbar, the
 * register page and anything already indexed or bookmarked, and a 404 on the sign-in
 * URL of an affiliate network is a bad first impression. One page to change if the
 * portal ever moves, instead of every call site.
 */
const AFFILIATE_URL = process.env.NEXT_PUBLIC_AFFILIATE_URL ?? 'http://localhost:5174';

// Never prerendered to a fixed destination — the portal URL comes from the
// environment, which differs between preview and production deploys.
export const dynamic = 'force-dynamic';

export default function LoginRedirect() {
  redirect(`${AFFILIATE_URL}/login`);
}
