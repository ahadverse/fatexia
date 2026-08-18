import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Section, ButtonLink } from '@/components/marketing';

/**
 * A branded 404 that still routes a crawler (and a visitor) somewhere useful.
 *
 * Next already returns a real 404 status and emits its own `noindex` here, so this only
 * needs to set the title — adding `robots` again would render a second, redundant meta
 * tag. The links below stay crawlable (noindex implies follow), so a broken inbound link
 * still passes through to the pages that matter instead of dead-ending.
 */
export const metadata: Metadata = {
  title: 'Page not found',
};

const DESTINATIONS = [
  { href: '/affiliates', label: 'For Affiliates', description: 'Offers, tracking links and payouts' },
  { href: '/advertisers', label: 'For Advertisers', description: 'Vetted traffic and verified conversions' },
  { href: '/verticals', label: 'Verticals', description: 'Every category we run traffic on' },
  { href: '/payments', label: 'Payments', description: 'Methods, schedules and payout math' },
  { href: '/faq', label: 'FAQ', description: 'Answers to the usual questions' },
  { href: '/blog', label: 'Blog', description: 'Notes from behind the tracker' },
];

export default function NotFound() {
  return (
    <>
      <PageHero
        eyebrow="404"
        title="That page isn't here"
        description="The link may be out of date, or the page may have moved. Here's where everything else lives."
      >
        <ButtonLink href="/" size="lg" withArrow>
          Back to home
        </ButtonLink>
        <ButtonLink href="/contact" variant="secondary" size="lg">
          Contact us
        </ButtonLink>
      </PageHero>

      <Section>
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          {DESTINATIONS.map((d) => (
            <Link key={d.href} href={d.href} className="group block">
              <div className="card-hover h-full rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground group-hover:text-primary">{d.label}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{d.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
