import { cta, sectionLabel, statusPanel, steps } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Offer access granted — `ACCESS_REQUEST_APPROVED`.
 *
 * The affiliate asked for this offer and has been waiting on the answer, so the
 * answer leads — with the offer named in the panel, because someone with six pending
 * requests needs to know which one this is before reading a word.
 *
 * The steps exist because a tracking link alone is not a working setup: traffic sent
 * before the postback is in place produces conversions the network records and the
 * affiliate's own tracker does not, and reconciling that afterwards is painful for
 * both sides. Short, because this reader already knows the platform — they requested
 * the offer.
 */
export const accessRequestApprovedTemplate: TemplateDesign = {
  render({ content, macros }: TemplateContext): string {
    const offer = macros.offer_name?.trim();
    const link = macros.offer_link?.trim();

    return [
      statusPanel({
        pill: 'Access granted',
        headline: offer || 'Your request was approved',
        caption: offer ? 'Your tracking link is ready in the portal.' : undefined,
      }),
      content,
      // The copy already carries a labelled button for this link, so a second one
      // would be two identical buttons — only added when the copy has none.
      link && !content.includes(link) ? cta(link, 'Open the offer') : '',
      sectionLabel('Getting live'),
      steps([
        {
          title: 'Copy your tracking link',
          detail: 'From the offer page, with any sub IDs you want to break results down by later.',
        },
        {
          title: 'Point your postback at us',
          detail: 'Before you send traffic, not after. Conversions fired before it exists will not reach your tracker.',
        },
        {
          title: 'Send one test click',
          detail: 'Check it lands on the right page and shows in your click report before you spend anything.',
        },
      ]),
    ]
      .filter(Boolean)
      .join('\n');
  },
};
