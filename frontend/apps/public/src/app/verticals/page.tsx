import type { Metadata } from 'next';
import { PageHero, Section, SectionHeading, VerticalCard, CTABanner } from '@/components/marketing';
import { Reveal } from '@/components/Reveal';
import { VERTICALS } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Verticals',
  description: 'Every category Fatexia runs traffic on — finance, nutra, sweepstakes, dating, mobile content, iGaming, e-commerce, insurance, software and lead-gen.',
};

export default function VerticalsPage() {
  return (
    <>
      <PageHero
        eyebrow="Verticals"
        title="Offers across every category that converts"
        description="Run the verticals that fit your traffic — from finance and nutra to iGaming and mobile content, across tier-1 and worldwide geos."
      />

      <Section>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VERTICALS.map((v, i) => (
            <Reveal key={v.name} delay={(i % 3) * 60}>
              <VerticalCard {...v} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <Reveal>
          <SectionHeading
            eyebrow="Payout models"
            title="Every major model, supported"
            description="Offers run on the model that fits — you always see exactly which one, and the allowed traffic, before you send a click."
          />
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              ['CPA', 'Cost per action'],
              ['CPL', 'Cost per lead'],
              ['CPS', 'Cost per sale'],
              ['CPI', 'Cost per install'],
              ['SOI / DOI', 'Single / double opt-in'],
              ['RevShare', 'Revenue share'],
            ].map(([code, label]) => (
              <div key={code} className="rounded-xl border border-border bg-card p-5 text-center">
                <div className="text-lg font-bold text-gradient-primary">{code}</div>
                <div className="mt-1 text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABanner title="Find offers that fit your traffic" description="Apply once and get access to every offer available for your traffic type." secondaryHref="/affiliates" secondaryLabel="For affiliates" />
        </Reveal>
      </Section>
    </>
  );
}
