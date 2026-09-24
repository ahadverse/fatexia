import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/marketing';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { LEGAL_ADDRESS, LEGAL_JURISDICTION, LEGAL_EMAIL } from '@/lib/legal';

export const metadata: Metadata = pageMetadata({
  title: 'Publisher Agreement',
  description: 'The terms an affiliate agrees to when running traffic on Fatexia: tracking, disclosure requirements, payout calculation, holds, reversals, and payment.',
  path: '/publisher-agreement',
});

const SECTIONS = [
  {
    heading: '1. Scope and relationship',
    body: `This Publisher Agreement applies to every affiliate ("publisher") account on Fatexia, operated from ${LEGAL_ADDRESS}. It sits alongside, and does not replace, the general Terms of Service. You act as an independent contractor when running traffic on the network — nothing here creates an employment, partnership, or agency relationship.`,
  },
  {
    heading: '2. Eligibility and application',
    body: 'Applications are reviewed manually before an account can run live traffic. We may ask for information about your traffic sources before approving an offer for your account, and may approve an account for some offers and not others based on the traffic type they need.',
  },
  {
    heading: '3. Tracking links and attribution',
    body: 'Every offer gives you a tracking link with your affiliate ID embedded. Route your traffic through it unmodified — a conversion can only be attributed to you if it can be traced back to a click our tracker recorded against your account. Do not strip, forge, or replay click identifiers.',
  },
  {
    heading: '4. Traffic requirements and disclosure',
    body: "Run only the traffic types an offer's targeting allows, in the geos and on the devices it allows. If an offer permits incentivized traffic, your own disclosure to that traffic must make clear what completing the action gets them and that a third party (the advertiser) is involved — silent incentivization is treated as undisclosed incentive traffic even on an offer that otherwise allows the incentive model.",
  },
  {
    heading: '5. Prohibited methods',
    body: 'The methods listed in the Terms of Service (Section 5) apply in full here: bot or automated traffic, datacenter/proxy traffic presented as genuine, cookie stuffing, forced redirects, unauthorized brand bidding, fake or duplicated leads, click injection, and self-conversions. A violation on one offer can result in suspension across your whole account, not just that offer.',
  },
  {
    heading: '6. Payout calculation',
    body: "Your payout on a conversion is whatever the offer's payout rule computes at the time of conversion — a flat amount, or a percentage of the sale value the advertiser's postback reports, applied at our published rate. The rate itself is never something a postback payload can change.",
  },
  {
    heading: '7. Holds and fraud review',
    body: "A conversion may sit in a hold before it is approved — either a hold period configured on the offer itself, or a fraud-review hold from our own pipeline (see the Anti-Fraud Policy). A held conversion is not part of your payable balance until it clears; we tune review to avoid over-blocking, but a held conversion is not guaranteed to be approved.",
  },
  {
    heading: '8. Reversals and chargebacks',
    body: 'An advertiser can reverse a conversion they later confirm was invalid, including one already paid to you. A reversal on a paid conversion is deducted from your current or future balance. This is not a penalty for something you did wrong on a genuine conversion — it is how the network stays accurate when a sale a payout was based on turns out not to have gone through on the advertiser\'s side.',
  },
  {
    heading: '9. Negative balances',
    body: "If reversals in a period exceed your available balance, the deficit carries forward and is recovered from your future payouts before any new balance is released to you. We will tell you if this happens to your account rather than let it show up silently in a payout you were expecting.",
  },
  {
    heading: '10. Referral commission',
    body: "Where a payout rule includes a referral or manager commission percentage, that share is paid to the party the rule designates (for example, an affiliate manager, or an affiliate who referred another affiliate) from the same conversion — it is a split of what the network pays out on that conversion, not an additional cost charged to you.",
  },
  {
    heading: '11. Payment schedule and method',
    body: "Payouts are released on the schedule agreed for your account, by one of the methods on our Payments page, to the payment details on file. You are responsible for keeping those details current and for any fee your chosen method charges on its end.",
  },
  {
    heading: '12. Taxes',
    body: 'You are solely responsible for determining and paying any tax that applies to income earned through the network in your jurisdiction. We do not withhold tax on your behalf unless legally required to.',
  },
  {
    heading: '13. Confidentiality',
    body: 'Payout rates, offer terms not marked public, and our fraud-detection methodology are confidential — do not share them outside what is needed to run your own traffic.',
  },
  {
    heading: '14. Term and termination',
    body: 'Either party may end the relationship at any time. Verified, non-fraudulent conversions confirmed before termination remain payable on the standard schedule; a termination for a prohibited-method violation forfeits the balance directly connected to that conduct, per the Terms of Service.',
  },
  {
    heading: '15. Limitation of liability',
    body: 'To the maximum extent permitted by law, our total liability to you under this Agreement is limited to the amount actually payable to you for the conversions a claim concerns. We are not liable for indirect or consequential losses.',
  },
  {
    heading: '16. Dispute resolution and governing law',
    body: `Raise a dispute with your account manager first. If it cannot be resolved informally, this Agreement is governed by the laws of the ${LEGAL_JURISDICTION}, and disputes are subject to the exclusive jurisdiction of its courts — the same terms as our general Terms of Service.`,
  },
  {
    heading: '17. Contact',
    body: `Affiliate questions can be sent to affiliates@fatexia.com, or to ${LEGAL_EMAIL} for anything else.`,
  },
];

export default function PublisherAgreementPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Publisher Agreement', path: '/publisher-agreement' }])} />
      <PageHero eyebrow="Legal" title="Publisher Agreement" description="What running traffic on Fatexia means for tracking, payouts, holds, and disputes." />
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
