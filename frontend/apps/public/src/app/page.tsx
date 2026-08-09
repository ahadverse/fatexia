import Link from 'next/link';
import { Check, ArrowRight, Users, Megaphone } from 'lucide-react';
import { ButtonLink, Eyebrow, SectionHeading, Section, GlowBackdrop, FeatureCard, VerticalCard, StatBand, CTABanner } from '@/components/marketing';
import { HeroVisual } from '@/components/HeroVisual';
import { TrackingDashboard } from '@/components/TrackingDashboard';
import { Reveal } from '@/components/Reveal';
import { FAQAccordion } from '@/components/FAQAccordion';
import { ListedOn } from '@/components/ListedOn';
import { FEATURES, STATS, STEPS, VERTICALS, TRAFFIC_SOURCES, PAYMENT_METHODS, FAQS, DIFFERENTIATORS, FRAUD_LAYERS } from '@/lib/content';

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------------- Hero -- */}
      <section className="relative overflow-hidden">
        <GlowBackdrop />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 mask-fade bg-grid opacity-40" />
        <div className="container-page max-w-7xl py-16 sm:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start">
                <Eyebrow>Now accepting affiliate applications</Eyebrow>
              </div>
              <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl xl:text-6xl">
                <span className="text-gradient">The CPA network built to</span> <span className="text-gradient-primary">show its work.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
                Real offers, an in-house tracker, and layered fraud detection — so every click, conversion, and payout traces back to a number you can actually verify.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <ButtonLink href="/register" size="lg" withArrow>
                  Become an Affiliate
                </ButtonLink>
                <ButtonLink href="/advertisers" variant="secondary" size="lg">
                  I&apos;m an Advertiser
                </ButtonLink>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-success" /> Free to join
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-success" /> Manual approval
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-success" /> Real-time reporting
                </span>
              </div>
            </div>

            {/* Product console */}
            <div className="lg:pl-6">
              <HeroVisual />
            </div>
          </div>
        </div>

        {/* Traffic-source bar */}
        <div className="border-y border-border bg-card/30 py-6">
          <div className="container-page max-w-7xl">
            <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Built for the traffic you already run</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {TRAFFIC_SOURCES.map((t) => (
                <span key={t.name} className="text-sm font-semibold text-muted-foreground/80">
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Stats -- */}
      <Section>
        <Reveal>
          <StatBand stats={STATS} />
        </Reveal>
      </Section>

      {/* --------------------------------------------------------- Features -- */}
      <Section tone="muted" id="features" glow>
        <Reveal>
          <SectionHeading
            eyebrow="Why Fatexia"
            title="Everything runs on infrastructure we built, not infrastructure we rent."
            description="That's what lets us be specific about how tracking and fraud detection actually work — instead of pointing at a black box."
          />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 60}>
              <FeatureCard {...feature} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------ Tracking dashboard -- */}
      <Section glow>
        <Reveal>
          <SectionHeading
            eyebrow="Tracking"
            title="Every click, captured in full"
            description="Geo, device, network, and fraud signals recorded the moment a click lands — one source of truth behind every number in your reports."
          />
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-14">
            <TrackingDashboard />
          </div>
        </Reveal>
      </Section>

      {/* -------------------------------------------------------- Verticals -- */}
      <Section pattern="dots">
        <Reveal>
          <SectionHeading
            eyebrow="Verticals"
            title="Offers across every category that converts"
            description="From finance and nutra to iGaming and mobile content — run the verticals that fit your traffic, worldwide."
          />
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
            Explore all verticals
          </ButtonLink>
        </div>
      </Section>

      {/* ------------------------------------------------------ How it works -- */}
      <Section tone="muted">
        <Reveal>
          <SectionHeading eyebrow="How it works" title="From application to your first payout" description="No hidden steps, no waiting on a black-box approval queue." />
        </Reveal>
        <div className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 70}>
              <div className="relative">
                <span className="font-mono text-sm font-semibold text-primary">{s.step}</span>
                <div className="mt-2 h-px w-full bg-gradient-to-r from-primary/50 to-transparent" />
                <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------- Fraud deep-dive -- */}
      <Section id="fraud-protection">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div>
              <Eyebrow>Fraud protection</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Fraud filtering, explained in plain language</h2>
              <p className="mt-4 text-muted-foreground">Most networks describe fraud protection as a black box. Ours is a layered pipeline, and we can actually tell you what each layer does:</p>
              <ul className="mt-8 space-y-6">
                {FRAUD_LAYERS.map((layer, i) => (
                  <li key={layer.title} className="flex gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                      <layer.icon className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, '0')}</span>
                        <span className="font-semibold text-foreground">{layer.title}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{layer.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="ring-gradient rounded-2xl border border-border bg-card p-8">
              <p className="text-sm font-semibold text-foreground">Why this matters for you</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Networks that over-block hurt honest affiliates chasing a false positive. Networks that under-block burn trust with advertisers. We score traffic on a weighted scale —
                <span className="text-foreground"> allow, hold for review, or block</span> — instead of one blunt rule applied to everyone.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {['Allow', 'Review', 'Block'].map((label, i) => (
                  <div key={label} className="rounded-lg border border-border bg-background p-3">
                    <div className={`text-xs font-semibold ${i === 0 ? 'text-success' : i === 1 ? 'text-warning' : 'text-destructive'}`}>{label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">A weighted score decides the band — not a single blunt rule.</p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------ Built different -- */}
      <Section tone="muted">
        <Reveal>
          <SectionHeading eyebrow="The difference" title="Built different, on purpose" description="Where Fatexia diverges from how most networks are put together." />
        </Reveal>
        <Reveal delay={80}>
          <div className="border-brand mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-3 gap-px bg-white/10 text-sm">
              <div className="bg-card px-4 py-4 font-semibold text-foreground">&nbsp;</div>
              <div className="bg-primary/[0.12] px-4 py-4 text-center text-base font-bold text-brand">Fatexia</div>
              <div className="bg-card px-4 py-4 text-center font-semibold text-muted-foreground">Typical network</div>
              {DIFFERENTIATORS.map((d) => (
                <div key={d.point} className="contents">
                  <div className="bg-card px-4 py-4 font-medium text-foreground">{d.point}</div>
                  <div className="flex items-center justify-center gap-2 bg-primary/[0.06] px-4 py-4 text-center font-medium text-foreground">
                    <Check className="size-4 shrink-0 text-success" /> <span>{d.fatexia}</span>
                  </div>
                  <div className="bg-card px-4 py-4 text-center text-muted-foreground/70">{d.typical}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Section>

      {/* --------------------------------------------------------- Payments -- */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="Payments" title="Get paid the way that works for you" description="Payouts are computed from each offer's rule and released on your schedule once conversions are verified." />
        </Reveal>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAYMENT_METHODS.map((m, i) => (
            <Reveal key={m.name} delay={i * 40}>
              <div className="sheen flex items-center gap-4 rounded-2xl border border-white/10 bg-card/80 p-5 transition-colors hover:border-primary/40">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand font-bold text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">{m.name.charAt(0)}</div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.note}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------- Affiliate / Advertiser split -- */}
      <Section tone="muted">
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="ring-gradient card-hover flex h-full flex-col rounded-2xl border border-border bg-card p-8">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                <Users className="size-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-foreground">For Affiliates</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Access every offer available to your traffic, grab tracking links with your ID baked in, and watch conversions and payouts update in real time.
              </p>
              <Link href="/affiliates" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Explore the affiliate side <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="ring-gradient card-hover flex h-full flex-col rounded-2xl border border-border bg-card p-8">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                <Megaphone className="size-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-foreground">For Advertisers</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Reach vetted traffic protected by a fraud pipeline we can explain layer by layer, with payouts computed from your rule — never inflated by traffic that shouldn&apos;t count.
              </p>
              <Link href="/advertisers" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Explore the advertiser side <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* -------------------------------------------------------------- FAQ -- */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Questions, answered" description="The essentials. Find the full list on our FAQ page." />
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-12 max-w-3xl">
            <FAQAccordion items={FAQS.slice(0, 5)} />
            <div className="mt-8 text-center">
              <ButtonLink href="/faq" variant="secondary" withArrow>
                See all FAQs
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* --------------------------------------------------- Directory listings -- */}
      <Section tone="muted">
        <Reveal>
          <SectionHeading
            eyebrow="Listed on"
            title="Find us where affiliates check networks out"
            description="Independent directories where you can look up Fatexia rather than take our word for it."
          />
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-12">
            <ListedOn />
          </div>
        </Reveal>
      </Section>

      {/* --------------------------------------------------------- Final CTA -- */}
      <Section>
        <Reveal>
          <CTABanner
            title="Ready to see what your traffic could earn?"
            description="Applications are reviewed manually — tell us about your traffic and we'll get you set up."
            secondaryHref="/affiliates"
            secondaryLabel="Learn more"
          />
        </Reveal>
      </Section>
    </>
  );
}
