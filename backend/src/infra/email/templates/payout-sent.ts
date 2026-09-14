import { cta, factRows, figurePanel } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Payout sent — `PAYOUT_SENT`.
 *
 * The one email in the set an affiliate actually wants, and the one that is read in
 * two seconds: how much, and is it really on its way. Everything else — the invoice
 * number, the period, the bank reference — matters only later, when they reconcile.
 *
 * So the money is the message. A "Paid" pill, then the amount at 42px, then the
 * currency and invoice as a caption; the particulars drop into a table below where
 * they can be found without being read. The copy sits between the two as the human
 * sentence.
 *
 * This replaces a four-line bullet list in which the amount, the invoice number and
 * the bank reference all had exactly the same weight — the version that made a payment
 * confirmation read like a packing slip.
 */
export const payoutSentTemplate: TemplateDesign = {
  render({ content, macros, portalUrl }: TemplateContext): string {
    const amount = macros.amount?.trim();
    const invoice = macros.invoice_number?.trim();

    const rows = (
      [
        ['Invoice', invoice],
        ['Period', macros.period],
        ['Reference', macros.payment_reference],
      ] as const
    )
      // A blank reference is normal — a transfer may not have one yet, and an empty
      // row reads as missing data rather than as not-applicable.
      .filter(([, value]) => value?.trim())
      .map(([label, value]) => ({ label, value: value!.trim() }));

    return [
      amount
        ? figurePanel({
            value: amount,
            label: 'Amount sent',
            pill: 'Paid',
            // Invoice number doubles as the caption so the figure is identifiable on
            // its own — forwarded to an accountant, that panel is the whole email.
            caption: invoice ? `Invoice ${invoice}` : undefined,
          })
        : '',
      content,
      rows.length > 0 ? factRows(rows) : '',
      cta(`${portalUrl}/payments`, 'View your payments'),
    ]
      .filter(Boolean)
      .join('\n');
  },
};
