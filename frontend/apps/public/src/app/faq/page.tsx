import type { Metadata } from 'next';
import { PageHero, Section, ButtonLink, CTABanner } from '@/components/marketing';
import { Reveal } from '@/components/Reveal';
import { FAQAccordion } from '@/components/FAQAccordion';
import { FAQS } from '@/lib/content';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about joining Fatexia, tracking, payments, and fraud & quality control.',
};

const CATEGORIES = ['Getting started', 'Offers', 'Tracking', 'Payments', 'Fraud & quality', 'Account & support'] as const;

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="FAQ" title="Everything you might want to ask" description="Grouped by topic. Still stuck? Reach out and a real person will get back to you." />

      <Section>
        <div className="mx-auto max-w-3xl space-y-14">
          {CATEGORIES.map((cat) => {
            const items = FAQS.filter((f) => f.category === cat);
            if (items.length === 0) return null;
            return (
              <Reveal key={cat}>
                <div>
                  <h2 className="mb-5 text-xl font-bold tracking-tight text-foreground">{cat}</h2>
                  <FAQAccordion items={items} />
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section tone="muted">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Didn&apos;t find your answer?</h2>
            <p className="mt-3 text-muted-foreground">We&apos;re happy to help — get in touch and we&apos;ll walk you through it.</p>
            <div className="mt-8">
              <ButtonLink href="/contact" withArrow>
                Contact us
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABanner title="Ready to get started?" description="Applications are reviewed manually and it's free to join." />
        </Reveal>
      </Section>
    </>
  );
}
