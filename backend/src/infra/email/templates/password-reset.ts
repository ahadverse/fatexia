import { alert, note } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Password reset — `PASSWORD_RESET`.
 *
 * No status panel and no figure: the button the copy carries is the whole message,
 * and anything placed above it competes with the one thing the reader came for. This
 * is the template where restraint is the professional choice.
 *
 * The dismissal notice is promoted instead. The copy's one-line "if you did not
 * request this" is the right instinct at the wrong weight — on the one send an
 * attacker triggers against someone else's account, that is the most important
 * sentence in the message and it should not be the smallest.
 *
 * It also answers the two questions the copy leaves open, which are what stop a
 * worried recipient from clicking the link "to cancel it" — the exact action the
 * attacker needs.
 */
export const passwordResetTemplate: TemplateDesign = {
  render({ content }: TemplateContext): string {
    return [
      content,
      alert({
        tone: 'warning',
        title: "Didn't ask for this?",
        body: 'No action is needed. Ignore this email and the link expires by itself. Your current password keeps working and nothing changes until someone opens that link — so there is no need to click it to cancel the request.',
      }),
      note({
        body: 'The link works once and only from this email. If it has expired, start again from the sign-in page rather than reusing an older message.',
      }),
    ].join('\n');
  },
};
