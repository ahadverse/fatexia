import { redirect } from 'next/navigation';
import { AFFILIATE_REGISTER_URL } from '@/lib/urls';

/**
 * The affiliate application lives in the Affiliate portal now, not here.
 *
 * Kept as a redirect rather than deleted: `/register` is the destination of every
 * call-to-action on this site (hero, footer, pricing, blog posts) and is the URL most
 * likely to have been shared or indexed.
 */
export const dynamic = 'force-dynamic';

export default function RegisterRedirect() {
  redirect(AFFILIATE_REGISTER_URL);
}
