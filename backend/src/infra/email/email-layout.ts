import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { env } from '../../common/env';
import type { EmailTemplateKey } from '../../modules/email-templates/email-template.entity';
import { BRAND, FONT, codePanel, cta, escapeHtml } from './templates/kit';
import { EMAIL_SHELL, designFor } from './templates';

// Matches the directory served by `express.static('public')` in app.ts — the logo has
// to be read from disk (for its dimensions) and fetched over HTTP (by the recipient's
// mail client) from the same place.
const LOGO_DIR = 'public';

/**
 * Renders a plain-text template body into a branded HTML email.
 *
 * Three pieces meet here:
 *
 *   templates/shell.ts      the header, card and footer every email shares
 *   templates/<name>.ts     an optional per-email design (see templates/index.ts)
 *   the admin's copy        from the `email_templates` row, macros already substituted
 *
 * This module renders the copy into HTML blocks, hands them to that email's design if
 * it has one, and fills the shell's slots with the result. What stays here is whatever
 * has to be computed: the block renderers below, the logo's height, and the
 * conditional footer copy.
 *
 * Written to the constraints email clients actually impose, not the ones a browser
 * does: table-based layout (Outlook's Word renderer has no flexbox/grid), every style
 * inlined (Gmail strips <style> when it clips a long message), a 600px shell, and no
 * gradients or web fonts on anything load-bearing. The brand gradient survives only as
 * a thin accent bar, where a client that ignores it just shows the solid fallback.
 *
 * Light palette on purpose: Fatexia's own surfaces are dark, but Gmail and Outlook
 * dark-mode auto-inversion mangles dark emails far more visibly than it does light
 * ones, so a light card between two black bands — header and legal strip — is the
 * version that renders the same everywhere. Auto-inversion leaves an already-dark band
 * alone and only lifts the white middle, which is the one part that survives it well.
 */

/**
 * Fills {{slot}} placeholders in the shell.
 *
 * The replacement is a function, not a string: a subject line containing $& or $1
 * would otherwise be read as a backreference by String.replace and corrupt the output.
 * An unknown slot is left as-is, so a typo shows up as visible {{text}} in a test send
 * instead of silently emptying part of the email.
 */
function fillSlots(template: string, slots: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => slots[key] ?? whole);
}

// `env.AFFILIATE_PORTAL_URL` is already stripped; this covers a caller-supplied one, so
// the footer never emits a `//offers/browse`.
function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
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
      // The code panel lives in the kit so a design can also place one deliberately.
      // This is the automatic path: a bare 4-8 digit line in the admin's copy.
      if (CODE_BLOCK.test(block)) return codePanel(block);

      const labelled = LABELLED_URL.exec(block);
      if (labelled) return cta(labelled[2]!, labelled[1]!);
      if (URL_ONLY.test(block)) return cta(block, 'Open');

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
  /**
   * Base URL the footer's nav links point at. Defaults to the affiliate portal, which
   * is where every template in this system sends its recipient — all nine of them are
   * affiliate-facing, as is the admin's own bulk send.
   */
  portalUrl?: string;
  /**
   * Which email this is, used to pick a per-template design from `templates/`.
   *
   * Optional because the admin's manual compose has no template behind it — that one
   * is one-off copy and correctly gets the plain shell.
   */
  templateKey?: EmailTemplateKey;
  /**
   * Macro values for this send, passed through to the design. Raw and unescaped — a
   * design escapes what it interpolates.
   */
  macros?: Record<string, string>;
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

/**
 * One footer nav link. A table would be more robust than inline anchors, but a row of
 * table cells cannot wrap, and four of them plus separators overflow a 320px client.
 * Inline anchors in a single paragraph reflow instead.
 */
function footerLink(href: string, label: string): string {
  // Semibold with an underline: in a footer full of grey copy, a plain-weight anchor
  // with neither reads as a caption and does not get clicked. The underline is set
  // explicitly rather than left to the client, several of which strip it by default.
  return `<a href="${escapeHtml(href)}" style="font-family:${FONT};font-size:13px;font-weight:600;color:${BRAND.ink};text-decoration:underline;text-underline-offset:2px;white-space:nowrap;">${escapeHtml(label)}</a>`;
}

export function renderEmailHtml({
  subject,
  body,
  networkName,
  supportEmail,
  logoUrl,
  portalUrl,
  templateKey,
  macros,
}: EmailLayoutInput): string {
  const logo = logoUrl ?? emailLogoUrl();
  const portal = stripSlash(portalUrl ?? env.AFFILIATE_PORTAL_URL);
  const name = escapeHtml(networkName);
  const separator = `<span style="color:${BRAND.separator};padding:0 9px;">&middot;</span>`;
  const nav = [
    footerLink(`${portal}/`, 'Dashboard'),
    footerLink(`${portal}/offers/browse`, 'Offers'),
    footerLink(`${portal}/payments`, 'Payments'),
    footerLink(`${portal}/messages`, 'Support'),
  ].join(separator);
  // Inbox preview line. Hidden in the body itself, so it never renders twice.
  const preheader = escapeHtml(body.replace(/\s+/g, ' ').trim().slice(0, 140));
  const year = new Date().getFullYear();

  // No "Questions?" prefix — the shell puts a "Need help?" label directly above this,
  // and the two together read as a stutter.
  const supportLine = supportEmail
    ? `Reply to this email, or write to <a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND.green};text-decoration:none;font-weight:600;">${escapeHtml(supportEmail)}</a>. A real person answers.`
    : 'Just reply to this email — a real person answers.';

  // The admin's copy, rendered to blocks. A design for this email decides where that
  // sits and what surrounds it; an email without one gets the copy on its own, which
  // is the right answer for the three-sentence transactional messages.
  const blocks = renderBlocks(body);
  const design = designFor(templateKey);
  const content = design
    ? design.render({ content: blocks, macros: macros ?? {}, networkName: name, portalUrl: portal })
    : blocks;

  return fillSlots(EMAIL_SHELL, {
    subject: escapeHtml(subject),
    preheader,
    content,
    support_line: supportLine,
    footer_nav: nav,
    network_name: name,
    year: String(year),
    logo_url: escapeHtml(logo),
    logo_width: String(LOGO_WIDTH),
    logo_height: String(LOGO_HEIGHT),
  });
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
