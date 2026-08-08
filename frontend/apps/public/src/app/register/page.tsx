import { redirect } from 'next/navigation';

/**
 * The affiliate application lives in the Affiliate portal now, not here.
 *
 * Kept as a redirect rather than deleted: `/register` is the destination of every
 * call-to-action on this site (hero, footer, pricing, blog posts) and is the URL most
 * likely to have been shared or indexed. One page to change if the portal ever moves.
 */
const AFFILIATE_URL = process.env.NEXT_PUBLIC_AFFILIATE_URL ?? 'http://localhost:5174';

// Never prerendered to a fixed destination — the portal URL comes from the
// environment, which differs between preview and production deploys.
export const dynamic = 'force-dynamic';

export default function RegisterRedirect() {
  redirect(`${AFFILIATE_URL}/register`);
}
