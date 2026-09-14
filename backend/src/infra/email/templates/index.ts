import { EmailTemplateKey } from '../../../modules/email-templates/email-template.entity';
import { accessRequestApprovedTemplate } from './access-request-approved';
import { accessRequestRejectedTemplate } from './access-request-rejected';
import { affiliateApprovedTemplate } from './affiliate-approved';
import { affiliateRejectedTemplate } from './affiliate-rejected';
import { affiliateSuspendedTemplate } from './affiliate-suspended';
import { offerLiveTemplate } from './offer-live';
import { payoutRejectedTemplate } from './payout-rejected';
import { payoutSentTemplate } from './payout-sent';
import { passwordResetTemplate } from './password-reset';
import { registerTemplate } from './register';
import { welcomeTemplate } from './welcome';
import type { TemplateDesign } from './types';

export type { TemplateContext, TemplateDesign } from './types';
export { EMAIL_SHELL } from './shell';

/**
 * Which email gets which design.
 *
 * All nine template keys are covered. The type stays `Partial` rather than a total
 * `Record` on purpose: the admin's manual compose has no key at all, and a key added
 * to the enum tomorrow should send a plain-shell email rather than fail to compile in
 * a module nobody thought to open.
 *
 * Each design adds only what its copy cannot carry — a figure, a sequence, a security
 * note, a tone. None of them restate the copy, and none of them own the wording: that
 * stays in `email_templates` and editable from the admin panel.
 */
const DESIGNS: Partial<Record<EmailTemplateKey, TemplateDesign>> = {
  [EmailTemplateKey.AFFILIATE_WELCOME]: registerTemplate,
  [EmailTemplateKey.AFFILIATE_VERIFIED]: welcomeTemplate,
  [EmailTemplateKey.PASSWORD_RESET]: passwordResetTemplate,
  [EmailTemplateKey.ACCESS_REQUEST_APPROVED]: accessRequestApprovedTemplate,
  [EmailTemplateKey.ACCESS_REQUEST_REJECTED]: accessRequestRejectedTemplate,
  [EmailTemplateKey.AFFILIATE_APPROVED]: affiliateApprovedTemplate,
  [EmailTemplateKey.AFFILIATE_REJECTED]: affiliateRejectedTemplate,
  [EmailTemplateKey.AFFILIATE_SUSPENDED]: affiliateSuspendedTemplate,
  [EmailTemplateKey.PAYOUT_SENT]: payoutSentTemplate,
  [EmailTemplateKey.PAYOUT_REJECTED]: payoutRejectedTemplate,
  [EmailTemplateKey.OFFER_LIVE]: offerLiveTemplate,
};

export function designFor(key: EmailTemplateKey | undefined): TemplateDesign | undefined {
  return key ? DESIGNS[key] : undefined;
}
