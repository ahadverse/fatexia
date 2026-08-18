import type { Metadata } from 'next';
import { Check, Link2, Shuffle, CornerDownRight, KeyRound, Tags, LayoutDashboard } from 'lucide-react';
import { PageHero, Section, SectionHeading, FeatureCard, VerticalCard, ButtonLink, CTABanner, StatBand } from '@/components/marketing';
import { Reveal } from '@/components/Reveal';
import { FAQAccordion } from '@/components/FAQAccordion';
import { FEATURES, VERTICALS, STEPS, FAQS, STATS } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';

const TOOLKIT = [
  { icon: Link2, title: 'Tracking links', description: 'Every offer gives you a link with your affiliate ID already embedded — no manual macros to wire up.' },
  { icon: Shuffle, title: 'Smart links', description: 'Run one URL that rotates to the best-matching live offer for each visitor, and let the network optimise the destination.' },
  { icon: CornerDownRight, title: 'Deep linking', description: 'Route traffic straight to a specific product or in-app page, where the offer allows it, for a tighter funnel.' },
  { icon: KeyRound, title: 'S2S postback', description: 'Set your postback URL once and get conversions pushed to your own stack in real time, with the usual macros.' },
  { icon: Tags, title: 'Sub IDs', description: 'Append your own sub-parameters to break performance down by campaign, creative or placement in your reports.' },
  { icon: LayoutDashboard, title: 'Real-time dashboard', description: 'Clicks, conversions and payout status update live — no nightly batch, no waiting to see what is working.' },
];

export const metadata: Metadata = pageMetadata({
  title: 'CPA Offers for Affiliates',
  description:
    'Run offers across every converting vertical, with tracking links built for your traffic, real-time reporting, and payouts computed from the rule every time.',
  path: '/affiliates',
  keywords: ['affiliate program', 'CPA offers', 'affiliate tracking links', 'smart links', 'S2S postback', 'affiliate payouts'],
});

const AFFILIATE_PERKS = [
  'Access to every offer available to your traffic type',
  'Tracking links with your affiliate ID already embedded',
  'Smart links that rotate to the best live offer',
  'Server-to-server postback to your own stack',
  'Real-time clicks, conversions & payout status',
  'Payouts released on your schedule',
];

export default function AffiliatesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'For Affiliates', path: '/affiliates' }])} />
      <PageHero
        eyebrow="For Affiliates"
        title="Run the traffic. Keep the receipts."
        description="Fatexia gives you real offers, tracking you can trust, and payouts you can reproduce from a rule — not a number you have to take on faith."
      >
        <ButtonLink href="/register" size="lg" withArrow>
          Become an Affiliate
        </ButtonLink>
        <ButtonLink href="/verticals" variant="secondary" size="lg">
          Browse verticals
        </ButtonLink>
      </PageHero>

      {/* Perks */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div>
              <SectionHeading align="left" eyebrow="What you get" title="Everything you need to send traffic with confidence" />
              <ul className="mt-8 space-y-3">
                {AFFILIATE_PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                      <Check className="size-3.5" />
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{perk}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <ButtonLink href="/register" withArrow>
                  Apply now
                </ButtonLink>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid gap-6 sm:grid-cols-2">
              {FEATURES.slice(0, 4).map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Steps */}
      <Section tone="muted">
        <Reveal>
          <SectionHeading eyebrow="How to join" title="Four steps to your first payout" />
        </Reveal>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 70}>
              <div>
                <span className="font-mono text-sm font-semibold text-primary">{s.step}</span>
                <div className="mt-2 h-px w-full bg-gradient-to-r from-primary/50 to-transparent" />
                <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Toolkit */}
      <Section glow>
        <Reveal>
          <SectionHeading eyebrow="Your toolkit" title="Everything you need to run and optimise" description="The tools that ship with every approved account — no add-ons, no upsells." />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLKIT.map((t, i) => (
            <Reveal key={t.title} delay={(i % 3) * 60}>
              <FeatureCard {...t} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Capability band */}
      <Section tone="muted">
        <Reveal>
          <SectionHeading eyebrow="Why Fatexia" title="Built on things you can verify" />
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-12">
            <StatBand stats={STATS} />
          </div>
        </Reveal>
      </Section>

      {/* Verticals */}
      <Section pattern="dots">
        <Reveal>
          <SectionHeading eyebrow="Verticals" title="Pick the categories that fit your traffic" description="A spread of high-demand verticals across tier-1 and worldwide geos." />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VERTICALS.slice(0, 6).map((v, i) => (
            <Reveal key={v.name} delay={i * 50}>
              <VerticalCard {...v} />
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/verticals" variant="secondary" withArrow>
            See all verticals
          </ButtonLink>
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Affiliate questions" />
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-12 max-w-3xl">
            <FAQAccordion items={FAQS.filter((f) => f.category === 'Getting started' || f.category === 'Payments')} />
          </div>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABanner title="Your traffic is worth more than you can prove elsewhere." description="Apply now — manual review, free to join, real-time from day one." secondaryHref="/faq" secondaryLabel="Read the FAQ" />
        </Reveal>
      </Section>
    </>
  );
}
