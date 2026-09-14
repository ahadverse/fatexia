import { note, sectionLabel, statusPanel, steps } from './kit';
import type { TemplateContext, TemplateDesign } from './types';

/**
 * Email verified — `AFFILIATE_VERIFIED`.
 *
 * Sent the moment the registration code is accepted. Its whole job is to close a
 * loop: someone has just typed a code into a form and needs to know it worked, and
 * what now owns their application.
 *
 * Neutral panel, not the ink one. Verifying an address is a step completed, not an
 * outcome — dressing it in the same treatment as an approval would tell them they
 * have been accepted, which is precisely the misreading this email exists to prevent.
 *
 * No call to action, deliberately. The account is still PENDING and login is gated on
 * approval (auth.service.ts), so a dashboard button here lands on a sign-in form that
 * refuses them — which reads as the application having failed.
 */
export const welcomeTemplate: TemplateDesign = {
  render({ content }: TemplateContext): string {
    return [
      statusPanel({
        tone: 'neutral',
        pill: 'Verified',
        headline: 'Your email is confirmed',
        caption: 'Your application is now with our team.',
      }),
      content,
      sectionLabel('Where you are'),
      steps([
        { title: 'Email verified', detail: 'Done — this address is confirmed and the code is used up.' },
        {
          title: 'Application in review',
          detail: 'A manager is looking at your traffic sources and volume. Usually one business day.',
        },
        {
          title: 'Decision by email',
          detail: 'Approved or not, it comes to this address. There is nothing to do until then.',
        },
      ]),
      note({
        body: 'Already running traffic on another network? Reply with stats or a reference — applications with something to check move through review faster than ones without.',
      }),
    ].join('\n');
  },
};
