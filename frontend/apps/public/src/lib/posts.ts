// Static, hand-authored blog content — a deliberate choice, not a stand-in for a
// missing backend. PLAN-frontend.md left the CMS question open (headless CMS vs a
// Backend-managed content model); this is the "simple, ship it now" option. Swap
// for a real content source later without changing the page components below.
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingTime: string;
  content: string[];
}

export const POSTS: BlogPost[] = [
  {
    slug: 'why-payouts-should-never-trust-the-postback',
    title: 'Why your payout should never come from the postback',
    excerpt: 'An advertiser postback tells you a conversion happened. It should never get to tell you what it was worth. Here\'s why that distinction matters.',
    publishedAt: '2026-07-10',
    readingTime: '4 min read',
    content: [
      "A conversion postback is, structurally, a message from someone else's server telling your network what to pay out. If your payout logic trusts that number directly, you've handed pricing control to whichever party benefits from inflating it.",
      "Fatexia's tracker treats a postback as a single fact: a conversion happened, at this time, for this click ID. Nothing more. The amount owed is always looked up fresh from the offer's own payout rule at the moment the conversion is processed — the same rule an affiliate can see before they ever send traffic.",
      'This isn\'t a subtle implementation detail. It\'s the difference between a payout you can reproduce from public information and one you have to take on faith. When a rule changes, it changes going forward — it doesn\'t retroactively rewrite what a past conversion was worth, and it never depends on a number typed into someone else\'s system.',
      "The practical effect: fewer disputes, because there's less to dispute. The math is always the same math, computed the same way, from a rule both sides can point to.",
    ],
  },
  {
    slug: 'datacenter-traffic-is-the-easy-problem',
    title: 'Datacenter traffic is the easy fraud problem. Here\'s the hard one.',
    excerpt: 'Blocking AWS and DigitalOcean IPs is nearly free. The traffic that actually costs networks money looks like a real residential visitor — because in a sense, it is.',
    publishedAt: '2026-07-16',
    readingTime: '5 min read',
    content: [
      'Every serious click-fraud discussion starts with datacenter filtering, and for good reason: it\'s cheap, it\'s local, and it catches a meaningful share of low-effort bots. If a click\'s ASN organization resolves to a known hosting provider, you can flag it before it ever touches your database, at zero marginal cost.',
      'But datacenter filtering only catches traffic that never bothered to hide. The traffic that actually costs a network money runs through residential proxy networks — real household IP addresses, rented out through consumer apps and SDKs, indistinguishable from a genuine visitor at the ASN level. A residential proxy IP belongs to a real ISP, in a real neighborhood, because it is one.',
      'That\'s the problem no local blocklist solves. It requires a live, crowdsourced reputation signal — a database of "this specific address has been seen behaving like a proxy exit point recently" — which is fundamentally a different kind of data than "this ASN belongs to Amazon." It\'s the one place in our fraud pipeline where we reach for an external signal, and we reach for it narrowly: only after the free local checks have already run, cached aggressively, and never as the sole reason to block a click outright.',
      'The honest framing: no single layer solves fraud. A network that tells you otherwise is selling a slogan, not a system.',
    ],
  },
  {
    slug: 'one-network-done-well',
    title: 'Why we\'re building one network instead of a platform for many',
    excerpt: 'White-label CPA platforms optimize for serving many networks adequately. We\'d rather serve one network well.',
    publishedAt: '2026-07-22',
    readingTime: '3 min read',
    content: [
      "Most of the CPA tracking software on the market is built to be resold — a white-label platform where the vendor's customer is another network operator, and the affiliates and advertisers are two steps removed from the people actually building the product.",
      'That model optimizes for breadth: enough configurability that any network can bend it to their shape, at the cost of every specific network getting a slightly generic experience. Multi-tenancy adds real architectural weight, too — isolation guarantees, per-tenant configuration, cross-tenant admin tooling — none of which makes the product better for the one network actually running on it.',
      "Fatexia made the opposite bet: one network, no tenants, no white-label layer. Every design decision — the payout math, the fraud pipeline, the reporting — is made for the offers and affiliates actually on this network, not for a hypothetical operator we're serving indirectly.",
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}
