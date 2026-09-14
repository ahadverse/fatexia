import { contactCard, cta, sectionLabel, statusPanel, steps } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Account approved — `AFFILIATE_APPROVED`.
 *
 * The best news the network ever sends, and it used to arrive as a paragraph. It now
 * opens on the status panel, the same shape the payout amount gets: the answer first,
 * the detail after.
 *
 * The copy's own getting-started list is replaced by a stepped block rather than sat
 * beside one — three first tasks in an ordered sequence is exactly what `steps` is
 * for, and two lists of the same three things would be worse than either alone. The
 * accompanying migration trims that list out of the editable copy.
 *
 * The manager is a card, not a closing sentence. On an affiliate network the manager
 * relationship is the product, and this is the one email where the recipient finds out
 * who theirs is.
 */
export const affiliateApprovedTemplate: TemplateDesign = {
  render({ content, macros, networkName, portalUrl }: TemplateContext): string {
    const manager = macros.manager_name?.trim();

    return [
      statusPanel({
        pill: 'Approved',
        headline: `You're in`,
        caption: `Your ${networkName} account is live and ready for traffic.`,
      }),
      content,
      cta(portalUrl, 'Open your dashboard'),
      sectionLabel('First three things'),
      steps([
        {
          title: 'Grab a tracking link',
          detail: 'Browse the offers you have access to and copy a link, with any sub IDs you want to report on.',
        },
        {
          title: 'Set your payout method',
          detail: 'Under Profile. Payouts cannot be released without it, however much you earn.',
        },
        {
          title: 'Add your postback URL',
          detail: 'Do this before you send traffic — conversions fired before it exists never reach your tracker.',
        },
      ]),
      // No card without a name: "Your manager" over a blank line is worse than saying
      // nothing, and an unassigned affiliate is a real state in this system.
      manager
        ? [
            sectionLabel('Your manager'),
            contactCard(
              manager,
              'Account manager',
              'Caps, payout bumps, and offers you cannot see yet — all of that goes through them. Replying to this email reaches them.',
            ),
          ].join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};
