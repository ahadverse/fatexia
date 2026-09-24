import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Section } from '@/components/marketing';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { LEGAL_OPERATOR, LEGAL_ADDRESS, LEGAL_EMAIL } from '@/lib/legal';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'Who operates Fatexia, what data we collect, why a click identifier exists, how long data is kept, and how to ask for it to be corrected or removed.',
  path: '/privacy',
});

const SECTIONS = [
  {
    heading: 'Who operates this site',
    body: `Fatexia is operated by ${LEGAL_OPERATOR}, based at ${LEGAL_ADDRESS} ("we", "us"). For the purposes of data protection law, this is the entity responsible for the data described below.`,
  },
  {
    heading: 'Information we collect',
    body: 'Account information you provide directly when you register or apply — name, email, password, and any details you add to your profile. Separately, our tracker collects click-level data when someone follows a tracking link: IP address, user agent, approximate geographic location and network/ASN, the referring page, and derived fraud-risk signals. If you contact us through the Contact page, we receive whatever you include in that message.',
  },
  {
    heading: 'How we use it',
    body: 'To operate your account, review and approve applications, calculate and release payouts, detect fraudulent or invalid traffic, provide reporting on your own campaigns, and respond to support requests. We do not sell click-level or account data to third parties, and we do not use it to build an advertising profile of you.',
  },
  {
    heading: 'Who we share it with',
    body: "An advertiser whose offer you ran receives the conversion data needed to validate and pay for that conversion — never your account credentials or unrelated activity. We use infrastructure providers (hosting, database, email delivery) to run the service; they process data on our behalf under their own security obligations and do not use it for their own purposes. We do not otherwise sell or rent your data.",
  },
  {
    heading: 'Fraud detection data',
    body: (
      <>
        IP-based signals (datacenter/ASN, and in select cases residential-proxy reputation) are used solely to score traffic quality. See our{' '}
        <Link href="/anti-fraud" className="text-primary hover:underline">
          Anti-Fraud Policy
        </Link>{' '}
        for how that scoring works, and our{' '}
        <Link href="/cookies" className="text-primary hover:underline">
          Cookie Policy
        </Link>{' '}
        for tracking identifiers.
      </>
    ),
  },
  {
    heading: 'Data retention',
    body: 'Click and conversion records are retained for as long as needed for reporting, payout verification, and dispute resolution — typically the lifetime of the account plus a reasonable period after, to handle late disputes or chargebacks. Account data is retained while your account is active and for a reasonable period after closure for the same reason.',
  },
  {
    heading: 'International transfers',
    body: "Our infrastructure providers may process and store data outside the country you access the site from, including within the European Union and the United States. Where that happens, we rely on the safeguards those providers offer for cross-border processing.",
  },
  {
    heading: 'Your rights',
    body: "You can ask us to give you a copy of the personal data we hold about you, correct it if it's wrong, or delete it — subject to what we're required to keep for fraud, payout, or legal record-keeping purposes described above. To exercise any of these, contact us using the details below.",
  },
  {
    heading: "Children's privacy",
    body: 'Fatexia is a business-to-business affiliate marketing platform and is not directed at, or intended for use by, children. We do not knowingly collect data from anyone under the age required by their local law to enter a binding agreement.',
  },
  {
    heading: 'Changes to this policy',
    body: 'We may update this policy as the site and the tracker evolve. Material changes will be reflected here with an updated date.',
  },
  {
    heading: 'Contact',
    body: `Questions about this policy, or a request to access/correct/delete your data, can be sent to ${LEGAL_EMAIL}. Approved affiliates and advertisers can also reach their account manager directly.`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Privacy Policy', path: '/privacy' }])} />
      <PageHero eyebrow="Legal" title="Privacy Policy" description="What we collect, why, and how to ask us about it." />
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted-foreground">Last updated: September 24, 2026</p>
          <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="text-xl font-semibold text-foreground">{s.heading}</h2>
                <p className="mt-3">{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
