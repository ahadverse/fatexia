// Hand-authored marketing content shared across the home page and the dedicated
// landing pages. Same status as the hand-authored blog posts: this is copy, not
// data pulled from a mock backend layer. Deliberately capability-based — Fatexia is
// new, so nothing here invents a track record (no fake payout totals, affiliate
// counts, or client logos). See PLAN-public-portal.md.

import type { LucideIcon } from 'lucide-react';
import {
  LineChart,
  ShieldCheck,
  Wallet,
  Link2,
  Zap,
  Globe2,
  Server,
  Radar,
  Clock,
  KeyRound,
  Layers,
  BadgeCheck,
} from 'lucide-react';

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FEATURES: Feature[] = [
  {
    icon: LineChart,
    title: 'A tracker built in-house, not bolted on',
    description:
      'Clicks and conversions run through our own tracking service — not a rented third-party redirect chain. Faster redirects, and a single source of truth for every number in your reports.',
  },
  {
    icon: ShieldCheck,
    title: 'Fraud filtering that runs before it costs you',
    description:
      'Datacenter and hosting traffic is filtered locally, at zero cost, before a click ever counts. Suspicious residential-proxy traffic gets a second layer of checks — flagged for review, not silently paid out.',
  },
  {
    icon: Wallet,
    title: 'Payouts computed from the rule, every time',
    description:
      "What you're owed is always calculated from the offer's own payout rule — never taken on faith from an advertiser's postback. No surprises, no disputes over numbers nobody can reproduce.",
  },
  {
    icon: Link2,
    title: 'Smart links & deep linking',
    description:
      'Send traffic to a single smart link that rotates to the best live offer, or deep link straight into an app or landing page when an offer supports it.',
  },
  {
    icon: Zap,
    title: 'Real-time reporting',
    description:
      'Clicks, conversions, and payout status update live — no waiting on a nightly batch job to see how a campaign is actually performing.',
  },
  {
    icon: KeyRound,
    title: 'Postback & API, done properly',
    description:
      'Server-to-server postbacks with per-offer secrets and IP allow-lists. Set your own affiliate postback once and get conversions pushed to your stack in real time.',
  },
];

export interface Stat {
  value: string;
  label: string;
  sub: string;
}

// Capability stats — each one is literally true of the platform, not a track record.
export const STATS: Stat[] = [
  { value: 'In-house', label: 'Click tracker', sub: 'Our own redirect + reporting engine, not a reseller' },
  { value: '3-layer', label: 'Fraud pipeline', sub: 'Datacenter → residential-proxy → conversion timing' },
  { value: 'Real-time', label: 'Reporting', sub: 'Live clicks, conversions & payout status' },
  { value: 'Rule-based', label: 'Payouts', sub: 'Recomputed from the offer rule, never trusted blindly' },
];

export interface Step {
  step: string;
  title: string;
  description: string;
}

export const STEPS: Step[] = [
  {
    step: '01',
    title: 'Apply',
    description: 'Tell us about your traffic sources and where you promote. Applications are reviewed by a real person, not an algorithm.',
  },
  {
    step: '02',
    title: 'Get approved',
    description: 'Once approved, your account goes live and you get access to every offer available to your traffic type.',
  },
  {
    step: '03',
    title: 'Grab your tracking link',
    description: 'Every offer gives you a unique tracking link with your affiliate ID baked in — no manual macros to remember.',
  },
  {
    step: '04',
    title: 'Earn on verified conversions',
    description: 'Payouts are calculated straight from the offer rule and paid on your schedule. Track everything live from your dashboard.',
  },
];

export interface Vertical {
  icon: LucideIcon;
  name: string;
  blurb: string;
  tags: string[];
}

export const VERTICALS: Vertical[] = [
  { icon: Wallet, name: 'Finance', blurb: 'Loans, credit cards, crypto, forex and trading offers with strong lead demand.', tags: ['CPL', 'CPA', 'Crypto'] },
  { icon: BadgeCheck, name: 'Nutra & Health', blurb: 'Skincare, supplements and wellness — trial, straight-sale and COD models.', tags: ['COD', 'Trial', 'SS'] },
  { icon: Zap, name: 'Sweepstakes', blurb: 'High-converting prize and gift-card flows built for volume traffic.', tags: ['SOI', 'DOI', 'CC-Submit'] },
  { icon: Globe2, name: 'Dating', blurb: 'Mainstream and niche dating across desktop and mobile, worldwide.', tags: ['SOI', 'DOI', 'PPS'] },
  { icon: Server, name: 'Mobile Content', blurb: 'App installs, subscriptions and pin-submit flows with carrier billing.', tags: ['CPI', 'CPS', 'Pin'] },
  { icon: Radar, name: 'iGaming', blurb: 'Casino, sports betting and poker with FTD and revenue-share models.', tags: ['CPA', 'FTD', 'RevShare'] },
  { icon: Layers, name: 'E-commerce', blurb: 'Cash-on-delivery and straight-sale physical products across regions.', tags: ['COD', 'SS'] },
  { icon: ShieldCheck, name: 'Insurance', blurb: 'Auto, health and life insurance lead-gen for tier-1 geos.', tags: ['CPL', 'CPA'] },
  { icon: KeyRound, name: 'Software & VPN', blurb: 'Antivirus, VPN and utility subscriptions with recurring payouts.', tags: ['CPS', 'Trial'] },
  { icon: LineChart, name: 'Lead Gen & Surveys', blurb: 'Surveys, education and home-services lead forms at scale.', tags: ['CPL', 'SOI'] },
];

export interface TrafficSource {
  name: string;
}

export const TRAFFIC_SOURCES: TrafficSource[] = [
  { name: 'Facebook Ads' },
  { name: 'Google / PPC' },
  { name: 'Native' },
  { name: 'Push' },
  { name: 'Pop / Redirect' },
  { name: 'Email' },
  { name: 'SEO' },
  { name: 'Influencer' },
];

export interface PaymentMethod {
  name: string;
  note: string;
}

// Kept to the rails the platform can actually record and pay on — the affiliate's
// payout profile offers exactly these three, so advertising more here would promise
// something no account can select.
export const PAYMENT_METHODS: PaymentMethod[] = [
  { name: 'Bank / Wire', note: 'Direct bank transfer in major currencies' },
  { name: 'PayPal', note: 'Fast payouts for smaller balances' },
  { name: 'USDT', note: 'Stablecoin payouts on TRC20, ERC20 or BEP20' },
  { name: 'USDC', note: 'Stablecoin payouts on ERC20, TRC20, BEP20 or Solana' },
  { name: 'BTC / ETH', note: 'Paid on the native chain at the day’s rate' },
  { name: 'LTC / TRX', note: 'Low-fee chains for smaller, frequent withdrawals' },
];

export interface Faq {
  category: string;
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
  {
    category: 'Getting started',
    question: 'How do I join Fatexia as an affiliate?',
    answer:
      "Apply through the Become an Affiliate form with your real traffic details. Every application is reviewed manually — we look at where and how you promote, not just a checkbox. Once you're approved your account goes live immediately.",
  },
  {
    category: 'Getting started',
    question: 'Is there a cost to join?',
    answer: 'No. Joining Fatexia as an affiliate is free. You earn on verified conversions and get paid out on your schedule.',
  },
  {
    category: 'Getting started',
    question: 'What traffic sources do you allow?',
    answer:
      'We support paid social, native, push, pop, search, email, SEO and influencer traffic. Allowed sources vary per offer — each offer lists exactly what it accepts, so you always know before you send a click.',
  },
  {
    category: 'Tracking',
    question: 'How does tracking work?',
    answer:
      'Every offer gives you a tracking link with your affiliate ID already embedded. Clicks route through our in-house tracker, which generates a click ID, runs fraud checks, and redirects to the offer — then matches conversions back by that click ID via server-to-server postback.',
  },
  {
    category: 'Tracking',
    question: 'Do you support S2S postback?',
    answer:
      'Yes. Set your affiliate postback URL once in your dashboard and we push conversions to your stack in real time. Offers are secured with per-offer secrets and IP allow-lists on the advertiser side.',
  },
  {
    category: 'Tracking',
    question: 'What are smart links?',
    answer:
      'A smart link is a single URL that automatically rotates to the best-matching live offer for each visitor, so you can run one link and let the network optimise the destination.',
  },
  {
    category: 'Payments',
    question: 'When and how do I get paid?',
    answer:
      'Payouts are calculated directly from each offer’s payout rule and released on your payment schedule once conversions are verified. We support bank/wire, PayPal and cryptocurrency (USDT, USDC, BTC, ETH, LTC and TRX).',
  },
  {
    category: 'Payments',
    question: 'How is my payout amount calculated?',
    answer:
      "Always from the offer's own payout rule on our side — never taken on faith from the advertiser's postback payload. That means the number you see is a number you can reproduce.",
  },
  {
    category: 'Fraud & quality',
    question: 'How does fraud filtering affect my earnings?',
    answer:
      'We filter obvious datacenter/bot traffic before it ever counts, so it never inflates then reverses your stats. Borderline traffic is scored and held for review rather than auto-blocked — we tune to avoid punishing honest affiliates over a false positive.',
  },
  {
    category: 'Fraud & quality',
    question: 'Why should an advertiser trust the traffic?',
    answer:
      'Because quality control runs on infrastructure we built and can explain layer by layer: local datacenter/ASN filtering, residential-proxy reputation checks, and click-to-conversion timing analysis — not a black box.',
  },

  // ---- Getting started (more) ----
  {
    category: 'Getting started',
    question: 'How long does approval take?',
    answer:
      "Applications are reviewed manually, usually within a couple of business days. We may follow up with a question about your traffic before approving — that human step is exactly what keeps quality high for everyone on the network.",
  },
  {
    category: 'Getting started',
    question: 'Do I need existing traffic or experience to apply?',
    answer:
      "You don't need a big résumé, but you do need real, legitimate traffic and to be straight with us about where it comes from. We approve on the quality and honesty of your sources, not how long you've been doing this.",
  },
  {
    category: 'Getting started',
    question: 'Which countries do you accept affiliates from?',
    answer:
      "We work with affiliates worldwide. A small number of regions may be restricted for compliance reasons — if that affects you, we'll tell you during review rather than leave you guessing.",
  },
  {
    category: 'Getting started',
    question: 'Can I have more than one account?',
    answer:
      "One account per affiliate. If you genuinely run separate businesses and need more than one, talk to us first — undisclosed duplicate accounts are grounds for suspension.",
  },

  // ---- Offers ----
  {
    category: 'Offers',
    question: 'What verticals and offers do you run?',
    answer:
      "Finance, nutra and health, sweepstakes, dating, mobile content, iGaming, e-commerce, insurance, software and VPN, and lead-gen — across tier-1 and worldwide geos. The Verticals page has the full breakdown.",
  },
  {
    category: 'Offers',
    question: 'How do I get access to an offer?',
    answer:
      "Once approved, you get access to every offer available for your traffic type. A few offers need a quick extra approval — you'll see which ones and can request access straight from your dashboard.",
  },
  {
    category: 'Offers',
    question: "Can I request an offer or vertical that isn't listed?",
    answer:
      "Yes. If you have strong traffic for something we're not running yet, tell your manager or reach out — we add offers based on real affiliate demand, not guesswork.",
  },
  {
    category: 'Offers',
    question: 'Do offers have caps or daily limits?',
    answer:
      "Some do — an advertiser may cap daily conversions or spend. Any cap is shown on the offer itself, so you never send traffic into a limit you couldn't see coming.",
  },
  {
    category: 'Offers',
    question: 'What geos and targeting rules apply?',
    answer:
      "Each offer lists its allowed countries, devices and traffic types. Traffic sent outside an offer's targeting won't convert and may be flagged, so always check the offer terms before you run it.",
  },

  // ---- Tracking (more) ----
  {
    category: 'Tracking',
    question: 'What is the {click_id} macro and do I need it?',
    answer:
      "It's the unique identifier our tracker assigns to every click. Your destination URL must carry the {click_id} macro so conversions can be matched back to the right click — offers can't go live without it, and it's added to your link automatically.",
  },
  {
    category: 'Tracking',
    question: 'Do you support deep linking?',
    answer:
      "Yes, where the offer allows it. You can route traffic straight to a specific product or in-app page instead of a generic landing page, which usually lifts conversion rates.",
  },
  {
    category: 'Tracking',
    question: 'Can I pass my own sub IDs for reporting?',
    answer:
      "Yes. Append your own sub-parameters to a tracking link to break performance down by campaign, creative or placement in your reports — the values flow through and back on the conversion.",
  },

  // ---- Payments (more) ----
  {
    category: 'Payments',
    question: 'What is the minimum payout threshold?',
    answer:
      "There's a minimum balance before a payout is released; the exact figure depends on your payment method and is shown in your account. Anything below it simply rolls over to the next cycle.",
  },
  {
    category: 'Payments',
    question: 'What payment frequency and terms do you offer?',
    answer:
      "Payouts run on a regular schedule once conversions are verified. Established affiliates with steady volume can discuss faster terms with their manager — we'd rather earn that trust than dangle it.",
  },
  {
    category: 'Payments',
    question: 'Which currencies can I be paid in?',
    answer:
      "Balances are held in USD. How you withdraw is up to you — bank/wire, PayPal, or crypto (USDT, USDC, BTC, ETH, LTC, TRX). For crypto you choose the coin and the network, and we pay to the wallet address on your profile.",
  },
  {
    category: 'Payments',
    question: 'What happens to conversions still under review at payout time?',
    answer:
      "Conversions held for fraud review aren't paid until they clear. Once verified they're included in the next payout; if they're rejected as fraudulent they aren't paid — your balance always reflects verified, payable actions.",
  },
  {
    category: 'Payments',
    question: 'Do you take any fees from my payouts?',
    answer:
      "Your payout is computed straight from the offer rule. Some payment providers charge their own transfer fees; we're upfront about which method carries what cost so there are no surprises.",
  },

  // ---- Fraud & quality (more) ----
  {
    category: 'Fraud & quality',
    question: 'What happens if some of my traffic gets flagged?',
    answer:
      "Borderline traffic is scored and held for review rather than auto-rejected, so a false positive doesn't cost you a legitimate conversion. Clearly fraudulent traffic — datacenter bots, spoofed clicks — is filtered before it ever counts.",
  },
  {
    category: 'Fraud & quality',
    question: 'Could legitimate traffic ever be blocked by mistake?',
    answer:
      "We tune deliberately to avoid over-blocking: the pipeline uses a weighted score with an allow / hold-for-review / block band instead of one blunt rule. If you believe something was mis-scored, your manager can look into it.",
  },
  {
    category: 'Fraud & quality',
    question: 'What is CTIT and why does it matter?',
    answer:
      "Click-to-conversion time. A conversion that lands implausibly fast after the click is a classic bot signature, so it's flagged for review. The threshold is tunable per vertical, because some legitimate offers — app installs, for example — genuinely convert fast.",
  },

  // ---- Account & support ----
  {
    category: 'Account & support',
    question: 'How do I contact support?',
    answer: "Reach us any time through the Contact page or your affiliate manager. Real people answer — no ticket-bot maze to fight through.",
  },
  {
    category: 'Account & support',
    question: 'Can I get a dedicated affiliate manager?',
    answer:
      "Active affiliates get a dedicated manager to help with offers, caps and optimisation — a person you can actually reach, not a shared inbox that never replies.",
  },
  {
    category: 'Account & support',
    question: 'How do I set up my postback URL?',
    answer:
      "Add your postback URL once in your dashboard and we push conversions to it in real time, substituting macros like {click_id}, payout, currency and status so your own stack stays in sync.",
  },
  {
    category: 'Account & support',
    question: 'What happens if my account goes inactive?',
    answer:
      "Accounts with no activity for a long stretch may be set inactive to keep the network clean. You can reactivate any time by getting back in touch — your history and details stay intact.",
  },
];

export interface Differentiator {
  point: string;
  fatexia: string;
  typical: string;
}

export const DIFFERENTIATORS: Differentiator[] = [
  { point: 'Tracking', fatexia: 'In-house tracker we own end to end', typical: 'Rented third-party redirect chain' },
  { point: 'Payout math', fatexia: 'Recomputed from the offer rule', typical: 'Trusted from the advertiser postback' },
  { point: 'Fraud', fatexia: '3 layers, explained in plain language', typical: 'A black box you can’t audit' },
  { point: 'Reporting', fatexia: 'Real-time, single source of truth', typical: 'Nightly batch, numbers that drift' },
  { point: 'Model', fatexia: 'One network, run well', typical: 'White-label juggling many tenants' },
];

export const FRAUD_LAYERS: { title: string; description: string; icon: LucideIcon }[] = [
  {
    icon: Server,
    title: 'Datacenter & hosting filter',
    description: 'Traffic from known cloud/hosting ASNs is flagged before it’s ever counted — locally, at zero cost.',
  },
  {
    icon: Radar,
    title: 'Residential-proxy detection',
    description: 'The one signal that genuinely needs an external reputation source — used sparingly, cached, never the sole basis for a block.',
  },
  {
    icon: Clock,
    title: 'Click-to-conversion timing',
    description: 'Conversions that arrive implausibly fast after a click get flagged for review instead of an automatic payout.',
  },
];

/**
 * Independent affiliate-network directories Fatexia is listed on.
 *
 * `logo` points at a file the site serves itself rather than hotlinking the
 * directory's own asset: a remote logo URL breaks silently the day they reorganise
 * their CDN, and it leaks a request from every visitor to a third party. Until the
 * files exist the card falls back to a typeset wordmark, so a missing asset degrades
 * instead of showing a broken image.
 *
 * Deliberately no star ratings or review counts here — Fatexia is new, and inventing
 * social proof is exactly what the site's honesty rule rules out.
 */
export const LISTING_SITES: { name: string; href: string; logo: string; blurb: string }[] = [
  {
    name: 'AffPaying',
    href: 'https://www.affpaying.com',
    logo: '/brands/affpaying.png',
    blurb: 'Affiliate network reviews written by the people running the traffic.',
  },
  {
    name: 'AffHub',
    href: 'https://affhub.com',
    logo: '/brands/affhub.png',
    blurb: 'Network directory and community for affiliate marketers.',
  },
  {
    name: 'OfferVault',
    href: 'https://www.offervault.com',
    logo: '/brands/offervault.png',
    blurb: 'One of the longest-running offer and network search engines.',
  },
  {
    name: 'AffPlus',
    href: 'https://affplus.com',
    logo: '/brands/affplus.png',
    blurb: 'Offer search engine aggregating campaigns across CPA networks.',
  },
];
