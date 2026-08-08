import { redirect } from 'next/navigation';
import { AFFILIATE_LOGIN_URL } from '@/lib/urls';

/**
 * Sign-in lives in the Affiliate portal now, not here.
 *
 * Kept as a redirect rather than deleted: `/login` is linked from the navbar and
 * anything already indexed or bookmarked, and a 404 on the sign-in URL of an
 * affiliate network is a bad first impression. One place to change if the portal
 * ever moves, instead of every call site.
 */
export const dynamic = 'force-dynamic';

export default function LoginRedirect() {
  redirect(AFFILIATE_LOGIN_URL);
}
