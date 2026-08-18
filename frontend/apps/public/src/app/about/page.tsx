import type { Metadata } from 'next';
import { LineChart, Calculator, ShieldCheck, Target, Eye, Wrench, Scale, Users, Layers, Rocket } from 'lucide-react';
import { PageHero, Section, SectionHeading, FeatureCard, StatBand, CTABanner, Eyebrow } from '@/components/marketing';
import { Reveal } from '@/components/Reveal';
import { STATS } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'About',
  description:
    'Why Fatexia is built the way it is: an in-house tracker, transparent payout math, and fraud detection you can actually explain.',
  path: '/about',
});

const PRINCIPLES = [
  {
    icon: LineChart,
    title: 'We built our own tracker',
    description:
      "Most networks route clicks through third-party platforms and inherit whatever fraud logic comes bundled. Fatexia's tracker is our own service — so when a click is flagged, that's a decision our code made and can explain.",
  },
  {
    icon: Calculator,
    title: 'Payouts are computed, not trusted',
    description:
      "An advertiser's postback tells us a conversion happened — it never gets to tell us what it's worth. The amount always comes from the offer's own payout rule, computed fresh every time.",
  },
  {
    icon: ShieldCheck,
    title: 'Fraud detection is layered, not binary',
    description:
      'Instead of a single yes/no gate, we score traffic — datacenter signals, proxy reputation, click-to-conversion timing — into allow, hold-for-review, or block, so edge cases get a second look.',
  },
  {
    icon: Target,
    title: 'One network, run well',
    description:
      "Fatexia isn't a white-label platform serving dozens of networks with divided attention. Every decision is made for the offers and affiliates actually running here — not a hypothetical operator.",
  },
];

const VALUES = [
  { icon: Eye, title: 'Transparency', description: 'Every number an affiliate or advertiser sees should trace back to a rule someone can actually read — not a vendor’s black box.' },
  { icon: Wrench, title: 'Ownership', description: 'We build the core ourselves — the tracker, the fraud pipeline, the payout math — so we can stand behind every decision it makes.' },
  { icon: Scale, title: 'Fairness', description: 'We score traffic on a weighted scale rather than over-blocking, so honest affiliates aren’t punished for a false positive.' },
  { icon: ShieldCheck, title: 'Integrity', description: 'Payouts are computed from the offer rule and never inflated by traffic that shouldn’t count. The math is the math.' },
  { icon: Target, title: 'Focus', description: 'One network, no tenants, no white-label layer — undivided attention on the offers and people actually running here.' },
  { icon: Users, title: 'Partnership', description: 'Real people answer, on both sides. Affiliates and advertisers get a person to reach, not a shared inbox that never replies.' },
];

const ROADMAP = [
  {
    icon: LineChart,
    stage: 'Now',
    title: 'The affiliate side, done correctly',
    description: 'Offers, in-house tracking, layered fraud detection, and rule-based payouts — built to work correctly before anything else gets layered on top.',
  },
  {
    icon: Rocket,
    stage: 'Next',
    title: 'Self-serve advertiser portal',
    description: 'A dashboard for advertisers to launch offers, set caps and payout rules, and watch verified conversions in real time. Until it ships, we onboard advertisers directly.',
  },
  {
    icon: Layers,
    stage: 'Ongoing',
    title: 'More verticals, richer reporting',
    description: 'We add offers and verticals based on real affiliate demand, and keep deepening the reporting so every number stays traceable as the network grows.',
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'About', path: '/about' }])} />
      <PageHero
        eyebrow="About"
        title="A network built to show its work"
        description="Fatexia is a CPA affiliate network built around one idea: every number an affiliate or advertiser sees should trace back to a rule someone can actually read — not a vendor's black box."
      />

      {/* Mission statement */}
      <Section>
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Our mission</Eyebrow>
            <p className="mt-6 text-2xl font-medium leading-relaxed text-foreground sm:text-3xl">
              To run a CPA network where <span className="text-brand">trust doesn&apos;t require faith</span> — where every click, conversion, and payout is a number both sides can reproduce from a rule, not take on someone&apos;s word.
            </p>
          </div>
        </Reveal>
      </Section>

      {/* The story / why */}
      <Section tone="muted" glow>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div>
              <SectionHeading align="left" eyebrow="Why we exist" title="Most networks ask you to trust a black box. We&apos;d rather open it." />
              <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
                <p>
                  Affiliate networks run on numbers — clicks, conversions, payouts — and yet most of those numbers come out of software the network itself only rents. When something looks off, the honest answer is often &ldquo;that&apos;s what the platform reported.&rdquo; That&apos;s not good enough for the people whose income depends on it.
                </p>
                <p>
                  So Fatexia is built the opposite way: the tracker, the fraud pipeline, and the payout logic are ours. That means we can tell you <span className="text-foreground">exactly</span> why a click was scored the way it was, and show you that a payout matches the offer&apos;s published rule — because it&apos;s our code that decided both.
                </p>
                <p>
                  It&apos;s a deliberately smaller bet than building a platform for many networks. We think one network run transparently beats a dozen run through a black box.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="border-brand relative overflow-hidden rounded-2xl border border-white/10 bg-card p-8">
              <div aria-hidden className="aurora pointer-events-none absolute inset-0 -z-10 opacity-70" />
              <blockquote className="text-lg font-medium leading-relaxed text-foreground">
                &ldquo;A network that tells you fraud is a solved problem is selling a slogan, not a system. We&apos;d rather show you the layers.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-muted-foreground">— The Fatexia team</p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Principles */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="Principles" title="Four decisions that define how we operate" description="These aren't taglines — they're the specific choices behind how the network is built." />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 60}>
              <FeatureCard {...p} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Values */}
      <Section tone="muted">
        <Reveal>
          <SectionHeading eyebrow="Values" title="What we optimise for" description="The things we protect even when it would be easier not to." />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={(i % 3) * 60}>
              <div className="sheen h-full rounded-2xl border border-white/10 bg-card/80 p-6">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                  <v.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-foreground">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Capability band */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="How it's built" title="Capability, not a track record we haven't earned yet" description="We're a new, focused network — so instead of vanity metrics, here's what's actually true of the platform." />
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-12">
            <StatBand stats={STATS} />
          </div>
        </Reveal>
      </Section>

      {/* Roadmap / where we are */}
      <Section tone="muted" glow>
        <Reveal>
          <SectionHeading eyebrow="Where we are" title="Building in the right order" description="Affiliate experience first, correctly — then everything else on top of a foundation that works." />
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {ROADMAP.map((r, i) => (
            <Reveal key={r.stage} delay={i * 70}>
              <div className="ring-gradient h-full rounded-2xl border border-white/10 bg-card p-7">
                <div className="flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                    <r.icon className="size-5" />
                  </div>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">{r.stage}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-foreground">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <Reveal>
          <CTABanner title="Run with a network that shows its work" description="Free to join, manually reviewed, transparent from the first click." secondaryHref="/blog" secondaryLabel="Read the blog" />
        </Reveal>
      </Section>
    </>
  );
}
