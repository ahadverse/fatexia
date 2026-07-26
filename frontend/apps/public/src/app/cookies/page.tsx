import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/marketing';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How Fatexia uses cookies and tracking identifiers across the public site and the tracker.',
};

const SECTIONS = [
  {
    heading: 'What cookies are',
    body: 'Cookies are small text files a website stores in your browser. They let a site remember things between requests — a session, a preference, or an identifier used to measure how traffic moves through the site.',
  },
  {
    heading: 'Essential cookies',
    body: 'Some cookies are required for the site to function — keeping you signed in to your account, remembering your theme, and protecting forms from abuse. These are always on because the site cannot work correctly without them.',
  },
  {
    heading: 'Tracking identifiers',
    body: 'Because Fatexia runs an affiliate network, our tracker assigns a click identifier (click_id) when you follow a tracking link. This identifier is how a conversion is matched back to the click that produced it — it is core to how payouts are attributed, and it is described in our Privacy Policy.',
  },
  {
    heading: 'Analytics',
    body: 'We may use analytics cookies to understand which pages are useful and where visitors get stuck, in aggregate. This helps us improve the site — it is not used to build an advertising profile of you.',
  },
  {
    heading: 'Managing cookies',
    body: 'You can clear or block cookies in your browser settings at any time. Blocking essential cookies may break parts of the site, such as staying signed in. Blocking analytics cookies has no effect on functionality.',
  },
  {
    heading: 'Changes to this policy',
    body: 'We may update this policy as the site and the tracker evolve. Material changes will be reflected here with an updated date.',
  },
];

export default function CookiesPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Cookie Policy" description="How we use cookies and tracking identifiers across the site and the tracker." />

      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <div className="mt-10 space-y-10">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="text-xl font-semibold text-foreground">{s.heading}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
              </section>
            ))}
          </div>
          <p className="mt-12 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            This policy describes the mechanism of how cookies and identifiers are used. Whether specific consent obligations (such as GDPR/CCPA) apply depends on the regions Fatexia serves — see our Privacy Policy for the full disclosure.
          </p>
        </div>
      </Section>
    </>
  );
}
