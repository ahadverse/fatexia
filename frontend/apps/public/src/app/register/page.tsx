import { redirect } from 'next/navigation';
import { AFFILIATE_REGISTER_URL } from '@/lib/urls';

/**
 * The affiliate application lives in the Affiliate portal now, not here.
 *
 * Kept as a redirect rather than deleted: `/register` is the destination of every
 * call-to-action on this site (hero, footer, pricing, blog posts) and is the URL most
 * likely to have been shared or indexed.
 *
 * SEO: same treatment as /login — noindex via the `X-Robots-Tag` header in
 * next.config.ts, excluded from the sitemap, 307 rather than 308. The search-intent
 * landing page for "join a CPA network" is /affiliates, which is indexable, carries the
 * schema markup, and links here; this route is a jump point, not a page to rank.
 */
export const dynamic = 'force-dynamic';

export default async function RegisterRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // A referral link shared as `fatexia.com/register?ref=CODE` has to survive the hop,
  // or the referrer loses the attribution for every signup that came through this
  // domain rather than the portal's.
  const ref = (await searchParams).ref;
  const code = Array.isArray(ref) ? ref[0] : ref;
  redirect(code ? `${AFFILIATE_REGISTER_URL}?ref=${encodeURIComponent(code)}` : AFFILIATE_REGISTER_URL);
}
