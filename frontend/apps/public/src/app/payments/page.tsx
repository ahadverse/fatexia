import type { Metadata } from 'next';
import { Wallet, Calculator, ShieldCheck, Clock } from 'lucide-react';
import { PageHero, Section, SectionHeading, ButtonLink, CTABanner } from '@/components/marketing';
import { Reveal } from '@/components/Reveal';
import { PAYMENT_METHODS, FAQS } from '@/lib/content';
import { FAQAccordion } from '@/components/FAQAccordion';

export const metadata: Metadata = {
  title: 'Payments',
  description: 'How Fatexia pays: methods, currencies, schedules, and why every payout is computed from the offer rule rather than trusted from a postback.',
};

const PAYMENT_PRINCIPLES = [
  { icon: Calculator, title: 'Computed, not trusted', description: "Every payout is calculated from the offer's own payout rule — never taken from the advertiser's postback payload." },
  { icon: ShieldCheck, title: 'Verified conversions only', description: 'Conversions clear the fraud pipeline before they count toward a payout, so your balance reflects real, payable actions.' },
  { icon: Clock, title: 'On your schedule', description: 'Payouts are released on your agreed payment terms once conversions are verified — no moving goalposts.' },
  { icon: Wallet, title: 'Paid your way', description: 'Bank/wire, PayPal, Payoneer, Wise, crypto and more — pick what works for your region and balance.' },
];

export default function PaymentsPage() {
  return (
    <>
      <PageHero
        eyebrow="Payments"
        title="Payouts you can reproduce"
        description="The number on your report is the number the rule says it should be — computed the same way every time, from a rule both sides can point to."
      >
        <ButtonLink href="/register" size="lg" withArrow>
          Start earning
        </ButtonLink>
      </PageHero>

      {/* Principles */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="How we pay" title="Four principles behind every payout" />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PAYMENT_PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 60}>
              <div className="ring-gradient card-hover h-full rounded-xl border border-border bg-card p-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                  <p.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Methods */}
      <Section tone="muted">
        <Reveal>
          <SectionHeading eyebrow="Methods" title="Withdraw the way that suits you" description="Available methods vary by region — you'll see exactly what's available to your account." />
        </Reveal>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAYMENT_METHODS.map((m, i) => (
            <Reveal key={m.name} delay={i * 40}>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
                <div className="flex size-11 items-center justify-center rounded-lg bg-brand text-base font-bold text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                  {m.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.note}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Payment questions" />
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-12 max-w-3xl">
            <FAQAccordion items={FAQS.filter((f) => f.category === 'Payments')} />
          </div>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABanner title="Get paid for traffic that actually converts" description="Free to join, manually reviewed, and paid from a rule you can verify." />
        </Reveal>
      </Section>
    </>
  );
}
