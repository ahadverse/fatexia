import { env } from '../../common/env';

// Mailgun's default host. EU accounts send through api.eu.mailgun.net instead, which is
// why the base URL is configurable rather than a constant.
const DEFAULT_BASE_URL = 'https://api.mailgun.net';

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  baseUrl: string;
}

/** Env, not the `integrations` table — see the MAILGUN_* block in env.ts for why. */
export function resolveMailgunConfig(): MailgunConfig {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_BASE_URL } = env;
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    throw new Error('Mailgun is not configured — set MAILGUN_API_KEY and MAILGUN_DOMAIN in the backend environment');
  }
  return {
    apiKey: MAILGUN_API_KEY,
    domain: MAILGUN_DOMAIN,
    baseUrl: (MAILGUN_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
  };
}

// Basic auth with the literal username "api" — Mailgun's scheme, not a placeholder.
function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`;
}

/**
 * Turns a failed Mailgun response into a message that names the cause.
 *
 * Same reasoning as the Brevo equivalent: Mailgun answers with `{ message }` — "Domain
 * not found", "Forbidden", or on a sandbox domain "not a valid recipient" for any
 * address that has not been authorised. Collapsing those into one generic string would
 * throw away the only part that says what to fix.
 */
async function describeMailgunError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  let parsed: { message?: string } | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as { message?: string }) : null;
  } catch {
    // Not JSON (a gateway or HTML error page) — fall through to the raw text.
  }
  const detail = parsed?.message || raw.slice(0, 300) || res.statusText;
  return `Mailgun returned HTTP ${res.status}: ${detail}`;
}

export interface MailgunSendInput {
  from: string;
  to: { email: string; name?: string | null };
  subject: string;
  html: string;
  text: string;
}

/** One transactional send. Form-encoded, which is what Mailgun's messages API takes. */
export async function sendViaMailgun(input: MailgunSendInput): Promise<void> {
  const config = resolveMailgunConfig();

  const form = new URLSearchParams({
    from: input.from,
    to: input.to.name ? `${input.to.name} <${input.to.email}>` : input.to.email,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  const res = await fetch(`${config.baseUrl}/v3/${config.domain}/messages`, {
    method: 'POST',
    headers: { authorization: authHeader(config.apiKey), 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!res.ok) {
    throw new Error(await describeMailgunError(res));
  }
}

/**
 * Validates the key and domain without sending, for the "Test connection" button.
 *
 * Hits the domain's own record rather than the account endpoint, because a key that is
 * valid but has no access to the configured sending domain would otherwise pass the
 * test and fail every real send.
 */
export async function probeMailgunDomain(apiKey: string, domain: string, baseUrl?: string): Promise<string> {
  const host = (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const res = await fetch(`${host}/v3/domains/${domain}`, {
    headers: { authorization: authHeader(apiKey), accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await describeMailgunError(res));
  }
  const data = (await res.json()) as { domain?: { name?: string; state?: string } };
  return data.domain?.name ? `${data.domain.name} (${data.domain.state ?? 'unknown state'})` : domain;
}
