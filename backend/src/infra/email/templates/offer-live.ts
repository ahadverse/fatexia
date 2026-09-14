import { cta, factRows, figurePanel, note } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * New offer is live — `OFFER_LIVE`.
 *
 * The one broadcast in the set. It goes to affiliates who did not ask for it,
 * competing with every other network's offer mail in the same inbox, and it is read
 * in about two seconds. The only question being asked is what it pays.
 *
 * So the rate leads as a figure and the offer's name is the caption under it — the
 * same panel the payout amount uses, because both answer "what is the number".
 *
 * No pill: nothing has happened to this reader. An offer going live is an
 * announcement, and a status badge would imply a decision about them.
 *
 * The caps warning is promoted out of the closing line. Scaling into a capped offer
 * is how an affiliate burns a day's spend on conversions that will not be paid, and
 * it is the one thing here that costs real money to miss.
 */
export const offerLiveTemplate: TemplateDesign = {
  render({ content, macros }: TemplateContext): string {
    const payout = macros.payout?.trim();
    const offer = macros.offer_name?.trim();
    const link = macros.offer_link?.trim();

    return [
      payout ? figurePanel({ value: payout, label: 'Payout per conversion', caption: offer || undefined }) : '',
      content,
      // Only when the copy has not already produced a button for it.
      link && !content.includes(link) ? cta(link, 'View the offer') : '',
      // Fallback identity when there is no figure to caption with the offer's name.
      !payout && offer ? factRows([{ label: 'Offer', value: offer }]) : '',
      note({
        tone: 'accent',
        title: 'Check before you scale',
        body: 'Caps and geo targeting are on the offer page and they move. Traffic sent outside the targeting, or past a cap, still converts — it just does not pay.',
      }),
    ]
      .filter(Boolean)
      .join('\n');
  },
};
