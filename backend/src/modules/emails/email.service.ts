import { ValidationError } from '../../common/errors';
import { logger } from '../../common/logger';
import { sendEmail } from '../../infra/email/brevo-mailer';
import { renderEmailHtml } from '../../infra/email/email-layout';
import { networkSettingService } from '../network-settings/network-setting.service';
import { substituteMacros } from '../email-templates/template-render';
import type { PreviewEmailDto, SendEmailDto, SendEmailResultDto } from './email.dto';

const MACRO_PATTERN = /\{([a-z0-9_]+)\}/gi;

/**
 * Resolves the composed text against the supplied macro values.
 *
 * Anything still without a value afterwards is a macro nobody filled in.
 * `substituteMacros` blanks those, which is right for an automatic trigger (better a
 * gap than a literal `{token}` in a customer's inbox) but wrong here: an admin who
 * forgot a field should be told, not have "Hi ," sent out over the network's name.
 */
async function resolve(dto: PreviewEmailDto) {
  const settings = await networkSettingService.getSettings();
  const macros: Record<string, string> = {
    network_name: settings.networkName,
    support_email: settings.supportEmail ?? '',
    ...(dto.macros ?? {}),
  };

  const unresolved = [...new Set([...`${dto.subject}\n${dto.body}`.matchAll(MACRO_PATTERN)].map((m) => m[1]!))].filter(
    (name) => !macros[name],
  );

  return {
    settings,
    unresolved,
    subject: substituteMacros(dto.subject, macros),
    body: substituteMacros(dto.body, macros),
  };
}

export const emailService = {
  /**
   * Admin-composed send, one recipient at a time.
   *
   * Deliberately not one Brevo call with every address in `to`: that would put the
   * whole list in each recipient's headers, so recipients would see each other's
   * addresses. One call per recipient keeps them isolated and lets a single bad
   * address fail on its own instead of taking the batch down with it.
   *
   * Never throws for a delivery failure — the caller gets a per-recipient breakdown,
   * because "3 sent, 1 rejected" is the useful answer, not a single 500.
   */
  async sendManual(dto: SendEmailDto): Promise<SendEmailResultDto> {
    const { subject, body, unresolved } = await resolve(dto);

    if (unresolved.length > 0) {
      throw new ValidationError(
        `Fill in a value for ${unresolved.map((name) => `{${name}}`).join(', ')} — or remove it from the text.`,
      );
    }

    const result: SendEmailResultDto = { sent: [], failed: [] };

    // Sequential, not Promise.all — a burst of parallel calls is exactly what trips
    // Brevo's rate limiting, and this path is never latency-critical.
    for (const email of [...new Set(dto.recipients.map((value) => value.toLowerCase()))]) {
      try {
        await sendEmail({ to: { email }, subject, body });
        result.sent.push(email);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Send failed';
        logger.warn({ err, email }, 'Manual email send failed');
        result.failed.push({ email, error: message });
      }
    }

    return result;
  },

  /**
   * Renders exactly what `sendManual` would send, without sending it.
   *
   * Rendered server-side rather than reimplemented in the admin app on purpose: a
   * preview built from a second copy of the layout would eventually disagree with the
   * real thing, which is the one failure a preview must not have.
   */
  async preview(dto: PreviewEmailDto): Promise<{ subject: string; html: string; unresolved: string[] }> {
    const { settings, subject, body, unresolved } = await resolve(dto);

    return {
      subject,
      html: renderEmailHtml({ subject, body, networkName: settings.networkName, supportEmail: settings.supportEmail }),
      unresolved,
    };
  },
};
