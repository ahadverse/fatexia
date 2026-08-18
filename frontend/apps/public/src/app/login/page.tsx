import { redirect } from 'next/navigation';
import { AFFILIATE_LOGIN_URL } from '@/lib/urls';

/**
 * Sign-in lives in the Affiliate portal now, not here.
 *
 * Kept as a redirect rather than deleted: `/login` is linked from the navbar and
 * anything already indexed or bookmarked, and a 404 on the sign-in URL of an
 * affiliate network is a bad first impression. One place to change if the portal
 * ever moves, instead of every call site.
 *
 * SEO: a redirecting page renders no HTML, so it cannot carry `metadata` — the noindex
 * signal is an `X-Robots-Tag` response header set in next.config.ts, and the route is
 * left out of app/sitemap.ts. The redirect is deliberately temporary (307) rather than
 * permanent: browsers cache a 308 aggressively, which would undo the "one place to
 * change if the portal moves" property above, and there is no ranking to preserve on a
 * URL that is noindexed either way.
 */
export const dynamic = 'force-dynamic';

export default function LoginRedirect() {
  redirect(AFFILIATE_LOGIN_URL);
}
