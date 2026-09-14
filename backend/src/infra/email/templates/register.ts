import { note, sectionLabel, steps } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Registration / email verification — `AFFILIATE_WELCOME`.
 *
 * The key is badly named: this is the verification email, sent on register, and the
 * code is its entire reason for existing. `AFFILIATE_VERIFIED` is the real welcome.
 *
 * No status panel here, deliberately — the code panel the layout renders from the
 * bare digits in the copy is already the hero, and a second dark panel above it would
 * split the one thing this email is for.
 *
 * What the design adds is the part the copy should not have to carry:
 *
 * - The sequence. Signing up is three stages and the reader is at the first, so the
 *   numbering is real information: you cannot be reviewed before you verify. Without
 *   it, people verify and then write in asking what happens next.
 * - The security line. Every code email owes an unexpected recipient a way to
 *   understand and dismiss it. Kept out of the editable copy on purpose — it is the
 *   one sentence here that should not be casually reworded away.
 */
export const registerTemplate: TemplateDesign = {
  render({ content, networkName }: TemplateContext): string {
    return [
      content,
      sectionLabel('What happens next'),
      steps([
        {
          title: 'Verify this address',
          detail: 'Enter the code above. It expires shortly, and a new one can be requested from the sign-up page.',
        },
        {
          title: 'We review your application',
          detail: 'A manager checks your traffic sources and volume. This usually takes one business day.',
        },
        {
          title: 'Start promoting',
          detail: 'Once approved you get offers, tracking links and a manager to run questions past.',
        },
      ]),
      note({
        body: `Didn't sign up? Ignore this email — the code expires on its own, and no ${networkName} account exists until an address is verified. Nobody can use it but you.`,
      }),
    ].join('\n');
  },
};
