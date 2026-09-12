import { logger } from '../../common/logger';
import { IntegrationProvider } from '../../modules/integrations/integration.entity';
import { getIntegrationApiKey } from '../../modules/integrations/integration-credentials';
import { networkSettingService } from '../../modules/network-settings/network-setting.service';
import { emailTemplateRepository } from '../../modules/email-templates/email-template.repository';
import type { EmailTemplateKey } from '../../modules/email-templates/email-template.entity';
import { substituteMacros } from '../../modules/email-templates/template-render';
import { renderEmailHtml, renderEmailText } from './email-layout';
import { sendViaMailgun } from './mailgun-mailer';

// Brevo is the network's mail relay, but the credential lives under the pre-existing
// generic `SMTP` provider row rather than a new enum value — one mail provider, one
// place to configure it, same as every other integration (PLAN-admin.md: "all
// credentials handled by admin").
const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_ACCOUNT_URL = 'https://api.brevo.com/v3/account';

interface SendTemplateEmailInput {
  templateKey: EmailTemplateKey;
  to: { email: string; name?: string | null };
  macros: Record<string, string>;
}

export interface SendEmailInput {
  to: { email: string; name?: string | null };
  subject: string;
  /** Plain text — converted to HTML here, same as a template body. */
  body: string;
}

/**
 * The one outbound call. Both the automatic template triggers and the admin's manual
 * compose go through this, so a green "Test connection" and a successful manual send
 * prove the exact path a real trigger will take.
 *
 * Throws (rather than logging and returning) so callers that want the failure — the
 * manual send, which reports per-recipient results — can see it. Trigger sites wrap
 * this in `safeSendEmail` instead, since a business action must never fail because a
 * mail send did.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const settings = await networkSettingService.getSettings();
  if (!settings.senderEmail) {
    throw new Error('No sender address configured (Emails → Settings)');
  }

  // Templates are authored as plain text; the branded HTML shell is applied here at
  // send time (see email-layout.ts) so the admin editor never has to hold markup.
  // Rendered once, before the provider split, so both relays send identical mail.
  const senderName = settings.senderName || settings.networkName;
  const html = renderEmailHtml({
    subject: input.subject,
    body: input.body,
    networkName: settings.networkName,
    supportEmail: settings.supportEmail,
  });
  const text = renderEmailText(input.body, settings.networkName, settings.supportEmail);

  // Which relay sends is an explicit setting, not "whichever is enabled" — with both
  // configured, the enabled flag cannot answer it.
  if (settings.emailProvider === 'MAILGUN') {
    await sendViaMailgun({
      from: `${senderName} <${settings.senderEmail}>`,
      to: input.to,
      subject: input.subject,
      html,
      text,
    });
    return;
  }

  const apiKey = await getIntegrationApiKey(IntegrationProvider.SMTP);
  if (!apiKey) {
    throw new Error('No Brevo API key configured, or the integration is disabled (Emails → Settings)');
  }

  const res = await fetch(BREVO_SEND_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: settings.senderEmail, name: senderName },
      to: [{ email: input.to.email, name: input.to.name || undefined }],
      subject: input.subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    throw new Error(await describeBrevoError(res));
  }
}

/**
 * Renders the named `email_templates` row and sends it through Brevo's transactional
 * API (plain `fetch`, no SDK — same style as the IPHub/ipapi.is/IPQS calls in
 * fraud/proxy-detection.ts).
 *
 * A missing/disabled template or an unconfigured provider is logged and skipped
 * rather than thrown — a trigger firing on an unconfigured system shouldn't look like
 * a crash. Real delivery failures still throw, and `safeSendEmail` catches those.
 */
export async function sendTemplateEmail(input: SendTemplateEmailInput): Promise<void> {
  const template = await emailTemplateRepository.findByKey(input.templateKey);
  if (!template || !template.enabled) {
    logger.warn({ templateKey: input.templateKey }, 'Email template missing or disabled, skipping send');
    return;
  }

  const settings = await networkSettingService.getSettings();
  const macros: Record<string, string> = {
    network_name: settings.networkName,
    support_email: settings.supportEmail ?? '',
    ...input.macros,
  };

  await sendEmail({
    to: input.to,
    subject: substituteMacros(template.subject, macros),
    body: substituteMacros(template.body, macros),
  });
}

/** Fire-and-forget wrapper — same pattern as notificationService.safeNotify. */
export function safeSendEmail(work: Promise<void>): void {
  void work.catch((err) => logger.error({ err }, 'Failed to send email'));
}

/**
 * Turns a failed Brevo response into a message that names the actual cause.
 *
 * Brevo answers errors with `{ code, message }` — e.g. `unauthorized` / "Key not
 * found", which is a different problem from `unauthorized` / "Account is not
 * activated", which is different again from a 400 naming an unverified sender.
 * Collapsing all of those into one hand-written "the API key was not accepted"
 * string threw away the only part of the response that says what to fix, so the
 * provider's own wording is always included verbatim.
 */
async function describeBrevoError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  let parsed: { code?: string; message?: string } | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as { code?: string; message?: string }) : null;
  } catch {
    // Not JSON (a gateway/HTML error page) — fall through to the raw text below.
  }

  const detail = parsed?.message
    ? `${parsed.message}${parsed.code ? ` (${parsed.code})` : ''}`
    : raw.slice(0, 300) || res.statusText;

  return `Brevo returned HTTP ${res.status}: ${detail}`;
}

/**
 * Validates a Brevo API key without sending mail, for the "Test connection" button
 * on Emails → Settings. Hits the account endpoint, which answers 200 with account
 * details for any accepted key.
 */
export async function probeBrevoAccount(apiKey: string): Promise<string> {
  const res = await fetch(BREVO_ACCOUNT_URL, { headers: { 'api-key': apiKey, accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(await describeBrevoError(res));
  }
  const data = (await res.json()) as { email?: string };
  return data.email ?? 'Brevo';
}
