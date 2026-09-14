import { cta, note, statusPanel } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Offer access refused — `ACCESS_REQUEST_REJECTED`.
 *
 * Neutral panel, and deliberately not an `alert`. A declined offer request is a
 * routine answer — usually the advertiser's own geo or traffic-source rules rather
 * than any judgement on the affiliate — and a red panel would tell them something
 * untrue about how serious it is. Red is not used anywhere in this set.
 *
 * The offer is named in the panel because an affiliate with several pending requests
 * needs to know which one this is before reading.
 *
 * What it adds is a way forward. The copy ends on "your manager is happy to talk
 * through alternatives", which is a sentence rather than an action — so the catalogue
 * gets a button and the reply route is spelled out.
 */
export const accessRequestRejectedTemplate: TemplateDesign = {
  render({ content, macros, portalUrl }: TemplateContext): string {
    const offer = macros.offer_name?.trim();

    return [
      statusPanel({
        tone: 'neutral',
        pill: 'Not approved',
        headline: offer ? `Access to ${offer}` : 'Your request was not approved',
        caption: 'This is about the offer, not your account — everything else is unaffected.',
      }),
      content,
      cta(`${portalUrl}/offers/browse`, 'Browse other offers'),
      note({
        body: "Most refusals come down to the advertiser's geo or traffic-source rules rather than your account, and those change. Reply to this email if you want your manager to look for something closer to the traffic you run.",
      }),
    ].join('\n');
  },
};
