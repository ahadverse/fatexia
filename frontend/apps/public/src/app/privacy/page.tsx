import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Section } from '@/components/marketing';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" />
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Draft placeholder — this page has not been reviewed by legal counsel and should not be treated as binding until it has been.
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">Information we collect</h2>
              <p className="mt-2">
                Account information you provide directly (email, password), plus click-level data collected by our tracker: IP address, user agent, approximate geographic location and network/ASN, and derived fraud-risk signals.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">How we use it</h2>
              <p className="mt-2">To operate your account, calculate payouts, detect fraudulent traffic, and provide reporting on your own campaigns. We do not sell click-level or account data to third parties.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">Fraud detection data</h2>
              <p className="mt-2">
                IP-based signals (datacenter/ASN, and in select cases residential-proxy reputation) are used solely to score traffic quality. See our{' '}
                <Link href="/about" className="text-primary hover:underline">
                  About page
                </Link>{' '}
                for how that scoring works, and our{' '}
                <Link href="/cookies" className="text-primary hover:underline">
                  Cookie Policy
                </Link>{' '}
                for tracking identifiers.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">Data retention</h2>
              <p className="mt-2">Click and conversion records are retained for as long as needed for reporting, payout verification, and dispute resolution.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">Contact</h2>
              <p className="mt-2">Questions about this policy can be directed to your account manager once your affiliate application is approved.</p>
            </section>
          </div>
        </div>
      </Section>
    </>
  );
}
