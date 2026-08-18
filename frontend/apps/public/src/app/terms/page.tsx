import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/marketing';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Service',
  description:
    'The terms that govern Fatexia affiliate accounts: eligibility, tracking and attribution, payout calculation, and termination.',
  path: '/terms',
});

const SECTIONS = [
  { heading: '1. Acceptance of terms', body: "By registering for or using Fatexia's affiliate network, you agree to these Terms of Service and any offer-specific terms attached to individual campaigns." },
  { heading: '2. Eligibility', body: "Affiliate accounts are subject to manual review and approval. Fatexia may suspend or reject accounts that misrepresent traffic sources or violate an offer's targeting terms." },
  {
    heading: '3. Tracking and attribution',
    body: "All clicks and conversions are tracked exclusively through Fatexia's own tracking service. Attempting to circumvent, spoof, or manipulate tracking (including tampering with click identifiers or user-agent data) is grounds for immediate account suspension and forfeiture of unpaid balances.",
  },
  {
    heading: '4. Payouts',
    body: "Payout amounts are calculated from each offer's published payout rule at the time of conversion. Conversions flagged by fraud review are held pending manual approval and are not guaranteed to be paid.",
  },
  {
    heading: '5. Termination',
    body: "Either party may terminate an affiliate's participation at any time. Amounts owed for verified, non-fraudulent conversions prior to termination remain payable per the standard payout schedule.",
  },
  { heading: '6. Changes to these terms', body: 'Fatexia may update these terms from time to time. Continued use of the network after an update constitutes acceptance of the revised terms.' },
];

export default function TermsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Terms of Service', path: '/terms' }])} />
      <PageHero eyebrow="Legal" title="Terms of Service" />
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Draft placeholder — this page has not been reviewed by legal counsel and should not be treated as binding until it has been.
          </p>
          <div className="mt-10 space-y-8">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="text-lg font-semibold text-foreground">{s.heading}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
