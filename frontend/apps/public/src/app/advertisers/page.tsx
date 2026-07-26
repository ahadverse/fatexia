import type { Metadata } from 'next';
import { ShieldCheck, Server, Wallet, LineChart, ClipboardList, BadgeCheck, Check } from 'lucide-react';
import { PageHero, Section, SectionHeading, FeatureCard, ButtonLink, Eyebrow } from '@/components/marketing';
import { Reveal } from '@/components/Reveal';
import { FRAUD_LAYERS } from '@/lib/content';

const ADVERTISER_STEPS = [
  { icon: ClipboardList, step: '01', title: 'Brief your offer', description: 'Send us the offer, payout rule, targeting and any caps. We set it up and generate the tracking and postback endpoints.' },
  { icon: ShieldCheck, step: '02', title: 'We protect the traffic', description: 'Every click runs the fraud pipeline before it counts — datacenter, proxy and timing checks — so only clean traffic reaches your funnel.' },
  { icon: BadgeCheck, step: '03', title: 'Conversions are verified', description: 'Inbound postbacks are checked against per-offer secrets and IP allow-lists, then held for review if a signal looks off.' },
  { icon: Wallet, step: '04', title: 'Pay for real actions', description: 'Payout value is computed from your rule — you pay for verified conversions, never for traffic that should never have counted.' },
];

const ADVERTISER_GETS = [
  'A fraud pipeline that runs before a click ever counts toward your spend',
  'Payouts computed from your own rule — no inflated numbers from the postback',
  'Per-offer postback secrets and IP allow-lists on every conversion',
  'One in-house tracker as the single source of truth for you and your affiliates',
  'Manual affiliate approval — real people vetting the traffic, not a checkbox',
  'Direct onboarding and a real person to talk to while the self-serve portal is built',
];

export const metadata: Metadata = {
  title: 'For Advertisers',
  description: 'Reach vetted affiliate traffic protected by a fraud pipeline we can explain layer by layer, with conversions verified and payouts computed from your own rule.',
};

const ADVERTISER_VALUE = [
  { icon: ShieldCheck, title: 'Traffic quality you can audit', description: 'A layered fraud pipeline runs on infrastructure we own — and we can walk you through what every layer does, not point at a black box.' },
  { icon: Wallet, title: 'Payouts from your rule, not guesswork', description: "Conversion value is computed from the offer's payout rule on our side — the postback confirms a conversion happened, it never dictates what it's worth." },
  { icon: LineChart, title: 'A single source of truth', description: 'Clicks and conversions run through one in-house tracker, so the numbers you see and the numbers your affiliates see come from the same place.' },
  { icon: Server, title: 'Secure server-to-server postback', description: 'Per-offer secrets and IP allow-lists on inbound postbacks — conversions are verified before they ever count.' },
];

export default function AdvertisersPage() {
  return (
    <>
      <PageHero
        eyebrow="For Advertisers"
        title="Performance traffic, without the fraud tax."
        description="List your offer on a network where quality control isn't a marketing slogan — it's a pipeline we built, own, and can explain layer by layer."
      >
        <ButtonLink href="/contact" size="lg" withArrow>
          Talk to us
        </ButtonLink>
        <ButtonLink href="/about" variant="secondary" size="lg">
          How the network works
        </ButtonLink>
      </PageHero>

      {/* Value props */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="Why advertise with us" title="Every layer built to protect your spend" description="The same transparency we give affiliates, pointed at the thing you care about: traffic you can trust." />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {ADVERTISER_VALUE.map((v, i) => (
            <Reveal key={v.title} delay={i * 60}>
              <FeatureCard {...v} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section tone="muted" glow>
        <Reveal>
          <SectionHeading eyebrow="How it works" title="From offer brief to verified payout" description="Four steps, and quality control runs through every one of them." />
        </Reveal>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {ADVERTISER_STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 70}>
              <div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                  <s.icon className="size-5" />
                </div>
                <span className="mt-4 block font-mono text-sm font-semibold text-primary">{s.step}</span>
                <h3 className="mt-1 text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* What you get */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div>
              <SectionHeading align="left" eyebrow="What you get" title="Spend protected at every layer" />
              <ul className="mt-8 space-y-3">
                {ADVERTISER_GETS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                      <Check className="size-3.5" />
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <ButtonLink href="/contact" withArrow>
                  Talk to us
                </ButtonLink>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid gap-6 sm:grid-cols-2">
              <FeatureCard icon={LineChart} title="Single source of truth" description="You and your affiliates read the same numbers, from one in-house tracker." />
              <FeatureCard icon={ShieldCheck} title="Auditable quality" description="A fraud pipeline we can explain layer by layer — not a black box." />
              <FeatureCard icon={Wallet} title="Rule-based payouts" description="Conversion value computed from your rule, every time." />
              <FeatureCard icon={Server} title="Secure postback" description="Per-offer secrets and IP allow-lists on every inbound conversion." />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Fraud pipeline */}
      <Section tone="muted">
        <Reveal>
          <SectionHeading eyebrow="Anti-fraud" title="The pipeline that protects your budget" description="Three layers, each doing a specific job — scored into allow, review, or block rather than one blunt gate." />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {FRAUD_LAYERS.map((layer, i) => (
            <Reveal key={layer.title} delay={i * 70}>
              <div className="ring-gradient card-hover rounded-xl border border-border bg-card p-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                  <layer.icon className="size-5" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-base font-semibold text-foreground">{layer.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{layer.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Honest portal-status note */}
      <Section>
        <Reveal>
          <div className="ring-gradient relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-8 text-center sm:p-12">
            <div className="flex justify-center">
              <Eyebrow>Self-serve portal — in progress</Eyebrow>
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Want to run an offer with us today?</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              The self-serve advertiser dashboard is on the roadmap. Until it&apos;s live, we onboard advertisers directly — reach out and we&apos;ll get your offer set up, tracked, and protected.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/contact" size="lg" withArrow>
                Get in touch
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
