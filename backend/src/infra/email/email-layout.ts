import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../../common/env';

// Matches the directory served by `express.static('public')` in app.ts — the logo has
// to be read from disk (for its dimensions) and fetched over HTTP (by the recipient's
// mail client) from the same place.
const LOGO_DIR = 'public';

/**
 * Renders a plain-text template body into a branded HTML email.
 *
 * Written to the constraints email clients actually impose, not the ones a browser
 * does: table-based layout (Outlook's Word renderer has no flexbox/grid), every style
 * inlined (Gmail strips <style> when it clips a long message), a 600px shell, and no
 * gradients or web fonts on anything load-bearing. The brand gradient survives only as
 * a thin accent bar, where a client that ignores it just shows the solid fallback.
 *
 * Light palette on purpose: Fatexia's own surfaces are dark, but Gmail and Outlook
 * dark-mode auto-inversion mangles dark emails far more visibly than it does light
 * ones, so a light card with a dark header band is the version that renders the same
 * everywhere.
 */

const BRAND = {
  green: '#22b470',
  greenDark: '#12ba9e',
  greenLime: '#6acb2a',
  ink: '#0f1720',
  text: '#232f3b',
  muted: '#6b7a89',
  hairline: '#e3e8ed',
  canvas: '#eef1f4',
  tintBg: '#f1faf5',
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// `**bold**` is the one inline mark worth supporting — it shows up naturally in
// hand-written copy and needs no editor to produce.
function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${BRAND.ink};font-weight:600;">$1</strong>`);
}

const CODE_BLOCK = /^\d{4,8}$/;
const URL_ONLY = /^https?:\/\/\S+$/;
// `[Label](https://…)` on its own line — lets a template name its button ("View the
// offer") instead of every CTA reading "Open". Same shape as a markdown link, which
// is what people try first anyway.
const LABELLED_URL = /^\[([^\]]{1,40})\]\((https?:\/\/\S+)\)$/;
const LABELLED_URL_INLINE = /\[([^\]]{1,40})\]\((https?:\/\/\S+)\)/g;
const BULLET = /^\s*[-•*]\s+/;

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${BRAND.text};">${inline(
    text,
  ).replace(/\n/g, '<br>')}</p>`;
}

/** A verification code deserves to be the thing the eye lands on first. */
function codeBlock(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
  <tr><td align="center" style="background:${BRAND.tintBg};border:1px solid #cdeadb;border-radius:10px;padding:20px 16px;">
    <div style="font-family:${FONT};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:8px;">Your code</div>
    <div style="font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:.28em;color:${BRAND.ink};padding-left:.28em;">${escapeHtml(code)}</div>
  </td></tr>
</table>`;
}

/**
 * Bare URL on its own line reads as the message's call to action.
 *
 * The raw address is printed under the button on purpose: a client that strips the
 * table, or a recipient who doesn't trust a button in an email about money, still has
 * something to copy.
 */
function button(url: string, label: string): string {
  const safeUrl = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr><td align="center" bgcolor="${BRAND.green}" style="border-radius:8px;">
    <a href="${safeUrl}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
  </td></tr>
  <tr><td style="padding-top:8px;font-family:${FONT};font-size:12px;color:${BRAND.muted};word-break:break-all;">${safeUrl}</td></tr>
</table>`;
}

function bulletList(lines: string[]): string {
  const items = lines
    .map(
      (line) =>
        `<li style="margin:0 0 8px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.text};">${inline(
          line.replace(BULLET, ''),
        )}</li>`,
    )
    .join('');
  return `<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
}

function renderBlocks(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((block) => {
      if (CODE_BLOCK.test(block)) return codeBlock(block);

      const labelled = LABELLED_URL.exec(block);
      if (labelled) return button(labelled[2]!, labelled[1]!);
      if (URL_ONLY.test(block)) return button(block, 'Open');

      const lines = block.split('\n');
      if (lines.every((line) => BULLET.test(line))) return bulletList(lines);

      return paragraph(block);
    })
    .join('\n');
}

export interface EmailLayoutInput {
  subject: string;
  body: string;
  networkName: string;
  supportEmail: string | null;
  /** Absolute URL to the wordmark. Defaults to the API's own `/logo.png`; override
   *  only to point at a different host. */
  logoUrl?: string;
}

/**
 * Where mail clients fetch the wordmark from.
 *
 * A dedicated setting rather than this API's own `/logo.png`, because the image is
 * fetched from the *recipient's* machine: the dev default of `localhost:4000` is
 * unreachable for them, so every email arrives with a broken logo. `EMAIL_LOGO_URL`
 * points at an image host that is always reachable and never sleeping.
 *
 * It must stay the same artwork as `public/logo.png` — the rendered height below is
 * derived from that local file's aspect ratio.
 */
export function emailLogoUrl(): string {
  return env.EMAIL_LOGO_URL;
}

/**
 * Rendered width of the wordmark; the height is derived from the file's own aspect
 * ratio rather than hardcoded.
 *
 * Both attributes have to be emitted — Outlook ignores CSS sizing on images and would
 * otherwise lay out the asset at its full pixel width, blowing the 600px shell apart
 * before the image even loads. Hardcoding the height is what breaks the moment
 * somebody swaps the logo for one with different proportions (it silently squashes),
 * so the ratio is read from the PNG instead.
 */
const LOGO_WIDTH = 165;

/** Reads width/height straight out of the PNG's IHDR chunk (bytes 16 and 20). */
function readPngRatio(path: string): number {
  const header = readFileSync(path).subarray(0, 24);
  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  return width > 0 && height > 0 ? width / height : 6;
}

// Resolved once at module load: the file does not change while the process runs, and
// this keeps it off the per-send path.
const LOGO_HEIGHT = (() => {
  try {
    return Math.round(LOGO_WIDTH / readPngRatio(join(LOGO_DIR, 'logo.png')));
  } catch {
    // Missing or unreadable file — fall back to the current asset's proportions. The
    // image itself will 404 for the recipient, but the layout still holds together.
    return 28;
  }
})();

export function renderEmailHtml({ subject, body, networkName, supportEmail, logoUrl }: EmailLayoutInput): string {
  const logo = logoUrl ?? emailLogoUrl();
  const name = escapeHtml(networkName);
  // Inbox preview line. Hidden in the body itself, so it never renders twice.
  const preheader = escapeHtml(body.replace(/\s+/g, ' ').trim().slice(0, 140));
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.canvas};">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;">

      <!-- Light header, not the dark band the dashboards use: the wordmark is dark navy
           on transparent, so on a dark ground it would be invisible for anyone whose
           client renders the alpha channel. -->
      <tr><td style="background:#ffffff;border-radius:14px 14px 0 0;padding:24px 32px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td>
            <img src="${escapeHtml(logo)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="${name}"
                 style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;border:0;outline:none;text-decoration:none;">
          </td>
          <td align="right" style="font-family:${FONT};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">
            Affiliate Network
          </td>
        </tr></table>
      </td></tr>

      <!-- Brand accent. Solid green in clients that drop the gradient. -->
      <tr><td style="height:3px;line-height:3px;font-size:0;background:${BRAND.green};background-image:linear-gradient(90deg,${BRAND.greenDark},${BRAND.green},${BRAND.greenLime});">&nbsp;</td></tr>

      <tr><td style="background:#ffffff;padding:28px 32px 26px;">
        <h1 style="margin:0 0 20px;font-family:${FONT};font-size:21px;line-height:1.35;font-weight:700;letter-spacing:-.01em;color:${BRAND.ink};">${escapeHtml(subject)}</h1>
        ${renderBlocks(body)}
      </td></tr>

      <tr><td style="background:#ffffff;border-radius:0 0 14px 14px;border-top:1px solid ${BRAND.hairline};padding:22px 32px 26px;">
        <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.6;color:${BRAND.muted};">
          ${supportEmail ? `Questions? Reply to this email or reach us at <a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND.green};text-decoration:none;font-weight:500;">${escapeHtml(supportEmail)}</a>.` : 'Questions? Just reply to this email.'}
        </p>
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#9aa7b4;">
          &copy; ${year} ${name}. You received this because you have an account with us.
        </p>
      </td></tr>

    </table>

  </td></tr>
</table>
</body>
</html>`;
}

/**
 * Plain-text alternative sent alongside the HTML. Not optional politeness: a
 * multipart message with no text part scores worse with spam filters, and it is what
 * a text-only client or a screen reader falls back to.
 */
export function renderEmailText(body: string, networkName: string, supportEmail: string | null): string {
  const cleaned = body
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // `[Label](url)` → `Label: url`, so the text part keeps both halves rather than
    // showing raw markup or losing the link.
    .replace(LABELLED_URL_INLINE, '$1: $2')
    .trim();
  const footer = supportEmail ? `\n\n—\n${networkName}\nQuestions? ${supportEmail}` : `\n\n—\n${networkName}`;
  return `${cleaned}${footer}`;
}
