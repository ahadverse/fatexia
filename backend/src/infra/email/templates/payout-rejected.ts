import { alert, cta, factRows, statusPanel } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Payout rejected — `PAYOUT_REJECTED`.
 *
 * The counterpart to `payout-sent`, and deliberately not its mirror image.
 *
 * That one leads with the amount at 42px in green, because the amount is the good
 * news. The same treatment here would put a large celebratory number at the top of an
 * email saying the money is not coming. So the figure is demoted into the table, and
 * the panel carries the state instead — neutral, not ink.
 *
 * The top of the message goes to the one fact that decides how this is received: the
 * earnings are held, not lost. Without that first, a rejected payout reads as
 * confiscation and the reply is written accordingly.
 *
 * `warning`, not `bad`: this is a payment that failed a check, not a judgement on the
 * affiliate. Most rejections are a stale payout detail or a KYC gap — both fixable by
 * the person reading, which is why the email ends by pointing them at the page where
 * they fix it.
 */
export const payoutRejectedTemplate: TemplateDesign = {
  render({ content, macros, portalUrl }: TemplateContext): string {
    const invoice = macros.invoice_number?.trim();

    const rows = (
      [
        ['Invoice', invoice],
        ['Amount', macros.amount],
        ['Period', macros.period],
      ] as const
    )
      .filter(([, value]) => value?.trim())
      .map(([label, value]) => ({ label, value: value!.trim() }));

    return [
      statusPanel({
        tone: 'neutral',
        pill: 'Not paid',
        headline: 'This payout did not go through',
        caption: invoice ? `Invoice ${invoice}` : undefined,
      }),
      alert({
        tone: 'warning',
        title: 'Your earnings are safe',
        body: 'Nothing has been cancelled. The conversions on this invoice return to your balance and go out on the next payout run once the cause is cleared.',
      }),
      content,
      rows.length > 0 ? factRows(rows) : '',
      cta(`${portalUrl}/profile`, 'Check your payout details'),
    ]
      .filter(Boolean)
      .join('\n');
  },
};
