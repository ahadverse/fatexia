import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/marketing';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { LEGAL_OPERATOR, LEGAL_ADDRESS, LEGAL_JURISDICTION, LEGAL_EMAIL } from '@/lib/legal';

export const metadata: Metadata = pageMetadata({
  title: 'Advertiser Agreement',
  description: 'The terms an advertiser agrees to when listing an offer on Fatexia: campaign approval, tracking requirements, billing, and conversion validation.',
  path: '/advertiser-agreement',
});

const SECTIONS = [
  {
    heading: '1. Scope',
    body: `This Advertiser Agreement applies to every advertiser account on Fatexia, operated by ${LEGAL_OPERATOR} (${LEGAL_ADDRESS}). It sits alongside, and does not replace, the general Terms of Service — where the two disagree on advertiser-specific matters, this Agreement controls.`,
  },
  {
    heading: '2. Campaign submission and approval',
    body: 'An offer goes live only after we review it: the landing page, the payout terms you propose, targeting, and any traffic restrictions. We may decline an offer, or ask for changes before approving it, at our discretion. An approved offer can still be paused or removed later if it stops meeting our standards or a legal or compliance concern arises.',
  },
  {
    heading: '3. Tracking and postback requirements',
    body: 'Every conversion must be reported to our tracker via server-to-server postback carrying the click identifier our redirect embedded and the sale amount the postback documentation asks for. A conversion we cannot match to a click through this mechanism cannot be validated or billed. You may not report a conversion through any channel other than the postback URL we issue for your offer.',
  },
  {
    heading: '4. Payout calculation basis',
    body: "The rate paid to the affiliate who sent the traffic is set by the payout rule configured on your offer, never by a figure your postback sends — a postback can report how large a sale was, on a revenue-share offer, but it never sets what percentage of it the affiliate keeps. This is deliberate: it is the guarantee that a postback cannot be used to change what the network owes an affiliate.",
  },
  {
    heading: '5. Conversion validation and lead rejection',
    body: "You may flag a conversion as invalid — duplicate, incomplete, fraudulent, or otherwise not meeting the offer's own qualifying criteria — within the review window agreed for your offer. Rejections must be made in good faith and tied to a real defect in the specific conversion, not used as a general mechanism to reduce cost after the fact.",
  },
  {
    heading: '6. Fraud and invalid traffic',
    body: "Our own fraud pipeline screens traffic before it is ever billed to you — see our Anti-Fraud Policy. If you identify a source of invalid traffic we have not caught, tell us; we investigate and, where warranted, hold or reject the affiliated conversions and take action on the account responsible.",
  },
  {
    heading: '7. Reversals and chargebacks',
    body: 'A conversion may be reversed after approval, including after payout, where it is later confirmed invalid under Section 5 — for example a returned sale or a confirmed instance of fraud. Reversals should be raised promptly; an advertiser that waits an unreasonable length of time to dispute a conversion may find it already paid out and outside a practical recovery window.',
  },
  {
    heading: '8. Advertiser billing and payment terms',
    body: 'Billing terms (rate, currency, invoicing cadence) are agreed per advertiser at onboarding. Invoices are due on the terms stated on them; late payment may result in your offers being paused until the account is current.',
  },
  {
    heading: '9. Prohibited offers',
    body: "We do not run offers that are illegal in the jurisdictions they target, that facilitate fraud against end users, or that we otherwise decline at our discretion (for example, certain high-risk categories may require additional compliance information before approval — see our Anti-Fraud Policy and, for regulated verticals, standard KYC expectations at onboarding).",
  },
  {
    heading: '10. Trademark and brand restrictions',
    body: 'Affiliates are prohibited by our Terms of Service from bidding on your brand or trademark terms without your written permission. If you want to explicitly allow this for your offer, say so in your offer terms — silence means it stays prohibited.',
  },
  {
    heading: '11. Confidentiality',
    body: 'Performance data, payout rates, and creative assets you share with us are used only to run your offer on the network and are not disclosed to a third party beyond what an affiliate needs to run compliant traffic to it.',
  },
  {
    heading: '12. Campaign suspension and cancellation',
    body: 'You may pause or end an offer at any time; affiliates already running approved traffic against it are notified so they can stop. Conversions generated before the pause remain subject to Sections 5 and 7 above.',
  },
  {
    heading: '13. Data and privacy',
    body: "Conversion data you receive through postbacks or reporting is provided so you can validate and pay for the traffic — it may not be used to build a profile of, or to re-target, end users beyond what your own privacy disclosures to them permit. See our Privacy Policy for what we collect and why.",
  },
  {
    heading: '14. Limitation of liability',
    body: 'To the maximum extent permitted by law, our liability to you under this Agreement is limited to the fees you have paid us in the three months preceding the claim. We are not liable for indirect or consequential losses, including lost revenue from a paused or removed offer.',
  },
  {
    heading: '15. Term and termination',
    body: 'This Agreement runs alongside your active advertiser account and ends when the account is closed by either party. Sections on billing, confidentiality, data, and liability survive termination for conversions and obligations that arose before it.',
  },
  {
    heading: '16. Dispute resolution and governing law',
    body: `Raise a dispute with your account manager first. If it cannot be resolved informally, this Agreement is governed by the laws of the ${LEGAL_JURISDICTION}, and disputes are subject to the exclusive jurisdiction of its courts — the same terms as our general Terms of Service.`,
  },
  {
    heading: '17. Contact',
    body: `Advertiser questions can be sent to advertisers@fatexia.com, or to ${LEGAL_EMAIL} for anything else.`,
  },
];

export default function AdvertiserAgreementPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Advertiser Agreement', path: '/advertiser-agreement' }])} />
      <PageHero eyebrow="Legal" title="Advertiser Agreement" description="What listing an offer on Fatexia means for approval, tracking, billing, and disputes." />
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted-foreground">Last updated: September 24, 2026</p>
          <div className="mt-10 space-y-10">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="text-xl font-semibold text-foreground">{s.heading}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
