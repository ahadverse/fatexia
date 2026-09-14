/**
 * The toolkit every email template design is built from.
 *
 * Kept separate from `email-layout.ts` so a template can import the tokens and blocks
 * without importing the renderer that will eventually call it — the registry in
 * `./index.ts` is imported *by* the layout, so anything shared has to sit below both
 * or the two modules form a cycle.
 *
 * Everything here obeys the same rules as the shell: tables, inline styles, no
 * external CSS and no web fonts. See `shell.ts` for why.
 */

/**
 * Colours shared by the shell and the generated blocks.
 *
 * `shell.ts` repeats the first four as literal hex, because that file has to stand on
 * its own when somebody opens it to edit the design. Change one, change both — the
 * shell's own header comment says so too.
 */
export const BRAND = {
  /** Buttons and links. */
  green: '#22b470',
  /** Lifted green for use on the ink panel — #22b470 is too dark to read on it. */
  greenBright: '#4ade9b',
  /** Headings and bold text. */
  ink: '#0f1720',
  /** Body copy. */
  text: '#232f3b',
  /** Captions, raw URLs, footnotes. */
  muted: '#6b7a89',
  /** Code-block and callout grounds. */
  tintBg: '#f1faf5',
  /** Panel ground for anything that is not an accent — notes, secondary strips. */
  panel: '#f7f9fa',
  /** Hairlines and panel borders. */
  hairline: '#e3e8ed',
  /** The dot between footer links. */
  separator: '#c8d0d8',
  /** Caution — a suspension, a hold, anything the reader must act on. */
  warnInk: '#92400e',
  warnBg: '#fffbeb',
  warnEdge: '#fde68a',
  warnRule: '#d97706',
  /** A decision that went against the reader. Never used for a mere warning. */
  badInk: '#991b1b',
  badBg: '#fef2f2',
  badEdge: '#fecaca',
  badRule: '#dc2626',
} as const;

export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The message's call to action.
 *
 * The raw address is printed under the button on purpose: a client that strips the
 * table, or a recipient who does not trust a button in an email about money, still
 * has something to copy.
 */
export function cta(url: string, label: string): string {
  const safeUrl = escapeHtml(url);
  // Centred, always — every button in every template comes through here.
  //
  // Three things do the centring, because no single one holds everywhere: the outer
  // table spans the column so there is a full width to centre within, `align="center"`
  // on the cell is what Outlook's Word renderer obeys (it ignores `margin:auto` on a
  // table), and the same attribute on the button table covers the clients that centre
  // the nested table rather than its contents.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
  <tr><td align="center" style="text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr><td bgcolor="${BRAND.green}" align="center" style="background:${BRAND.green};border-radius:8px;">
        <a href="${safeUrl}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding-top:10px;text-align:center;font-family:${FONT};font-size:12px;color:${BRAND.muted};word-break:break-all;">${safeUrl}</td></tr>
</table>`;
}

/** Hairline between the admin's copy and whatever the design adds under it. */
export function divider(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;">
  <tr><td style="height:1px;line-height:1px;font-size:0;background:${BRAND.hairline};">&nbsp;</td></tr>
</table>`;
}

export interface NoteInput {
  title?: string;
  body: string;
  /** Accent panel instead of the neutral one — for anything the reader must not miss. */
  tone?: 'neutral' | 'accent';
}

/**
 * A quiet panel for the things a transactional email owes the reader but that do not
 * belong in the main copy — security notes, "ignore this if it wasn't you", caveats.
 */
export function note({ title, body, tone = 'neutral' }: NoteInput): string {
  const ground = tone === 'accent' ? BRAND.tintBg : BRAND.panel;
  const edge = tone === 'accent' ? '#cdeadb' : BRAND.hairline;
  // A left rule rather than a full border on its own: it marks the block as an aside
  // without turning it into a second card competing with the steps above it.
  const rule = tone === 'accent' ? BRAND.green : '#c3ccd4';
  const heading = title
    ? `<div style="font-family:${FONT};font-size:12.5px;font-weight:700;color:${BRAND.ink};margin-bottom:4px;">${escapeHtml(title)}</div>`
    : '';

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 4px;">
  <tr><td bgcolor="${ground}" style="background:${ground};border:1px solid ${edge};border-left:3px solid ${rule};border-radius:8px;padding:13px 16px;">
    ${heading}<div style="font-family:${FONT};font-size:12.5px;line-height:1.6;color:${BRAND.muted};">${body}</div>
  </td></tr>
</table>`;
}

/**
 * The one-time code, as the thing the eye lands on first.
 *
 * Dark panel rather than the pale mint tint this used to be: a 15%-accent wash over
 * white is barely a panel at all, and the code is the entire reason a verification
 * email exists. Ink ground with the digits in brand green also bookends the black
 * header, and — unlike a light panel — it is left alone by Gmail's dark-mode
 * auto-inversion instead of being lifted to something else.
 */
export function codePanel(code: string, label = 'Verification code'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;">
  <tr><td bgcolor="${BRAND.ink}" align="center" style="background:${BRAND.ink};border-radius:12px;padding:24px 16px 26px;">
    <div style="font-family:${FONT};font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7f8d9b;margin-bottom:12px;">${escapeHtml(label)}</div>
    <div class="fx-code" style="font-family:${MONO};font-size:36px;line-height:1;font-weight:700;letter-spacing:.3em;color:${BRAND.greenBright};padding-left:.3em;">${escapeHtml(code)}</div>
  </td></tr>
</table>`;
}

/**
 * A single figure, given the weight the message's whole point deserves — a payout
 * amount, a per-conversion rate.
 *
 * Same ink panel as the code, deliberately: a recipient learns the shape once and
 * then knows at a glance where the number is in any email from this network. Money
 * gets no letter-spacing, unlike a code — tracking makes a sum harder to read, not
 * easier, because the digit grouping is already doing that work.
 */
export interface FigurePanelInput {
  value: string;
  label: string;
  /** Small line under the figure — a currency, an invoice number, a qualifier. */
  caption?: string;
  /** Status pill above the figure, e.g. "Paid". Omit for a plain figure. */
  pill?: string;
}

export function figurePanel({ value, label, caption, pill }: FigurePanelInput): string {
  // A pill rather than more words: the state of a payment is a single fact, and at
  // the top of the panel it is read before the number is, which is the order the
  // reader actually wants ("did it go?" then "how much?").
  const badge = pill
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 14px;">
      <tr><td bgcolor="#10261c" style="background:#10261c;border:1px solid #1d4a36;border-radius:999px;padding:5px 12px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.greenBright};white-space:nowrap;">${escapeHtml(pill)}</td></tr>
    </table>`
    : '';
  const foot = caption
    ? `<div style="font-family:${FONT};font-size:12.5px;color:#8895a3;margin-top:12px;">${escapeHtml(caption)}</div>`
    : '';
  const heading = `<div style="font-family:${FONT};font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7f8d9b;margin-bottom:10px;">${escapeHtml(label)}</div>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;">
  <tr><td bgcolor="${BRAND.ink}" align="center" style="background:${BRAND.ink};border-radius:12px;padding:26px 16px 28px;text-align:center;">
    ${badge}${heading}
    <div class="fx-figure" style="font-family:${FONT};font-size:42px;line-height:1.05;font-weight:700;letter-spacing:-.02em;color:${BRAND.greenBright};">${escapeHtml(value)}</div>
    ${foot}
  </td></tr>
</table>`;
}

export interface StatusPanelInput {
  /** Pill above the headline — the state in one or two words. */
  pill: string;
  /** The headline. Short: this is read at a glance, not parsed. */
  headline: string;
  caption?: string;
  /**
   * `positive` is the ink panel the payout figure uses — the house style for "this
   * is the point of the email". `neutral` is the same shape in light grey, for a
   * state that is real but not good news; nothing here should ever feel celebratory
   * about a decision that went against the reader.
   */
  tone?: 'positive' | 'neutral';
}

/**
 * The state of things, given the weight a figure gets when there is no figure.
 *
 * An approval, a verification, a suspension — the message is a status, and without
 * this it arrives as a paragraph the reader has to parse to find out what happened.
 * Same panel geometry as `figurePanel` on purpose: one recognisable shape carries
 * "here is the answer" across every email the network sends.
 */
export function statusPanel({ pill, headline, caption, tone = 'positive' }: StatusPanelInput): string {
  const positive = tone === 'positive';
  const ground = positive ? BRAND.ink : BRAND.panel;
  const pillBg = positive ? '#10261c' : '#ffffff';
  const pillEdge = positive ? '#1d4a36' : BRAND.hairline;
  const pillInk = positive ? BRAND.greenBright : BRAND.muted;
  const headInk = positive ? '#ffffff' : BRAND.ink;
  const capInk = positive ? '#8895a3' : BRAND.muted;
  const edge = positive ? '' : `border:1px solid ${BRAND.hairline};`;

  const foot = caption
    ? `<div style="font-family:${FONT};font-size:13px;line-height:1.55;color:${capInk};margin-top:10px;">${escapeHtml(caption)}</div>`
    : '';

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;">
  <tr><td bgcolor="${ground}" align="center" style="background:${ground};${edge}border-radius:12px;padding:24px 20px 26px;text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 14px;">
      <tr><td bgcolor="${pillBg}" style="background:${pillBg};border:1px solid ${pillEdge};border-radius:999px;padding:5px 12px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${pillInk};white-space:nowrap;">${escapeHtml(pill)}</td></tr>
    </table>
    <div class="fx-status" style="font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-.01em;color:${headInk};">${escapeHtml(headline)}</div>
    ${foot}
  </td></tr>
</table>`;
}

export interface FactRow {
  label: string;
  value: string;
}

/**
 * Label/value pairs as a bordered table — an invoice's particulars, an offer's terms.
 *
 * Two real columns rather than a bullet list, because these get scanned for one value
 * ("what was the reference?") and a list forces the reader through the prose to find
 * it. The label column is fixed and narrow so every value starts on the same line.
 */
export function factRows(rows: FactRow[]): string {
  const cells = rows
    .map((row, index) => {
      const edge = index === rows.length - 1 ? '' : `border-bottom:1px solid ${BRAND.hairline};`;
      return `<tr>
    <td valign="top" style="${edge}padding:11px 10px 11px 16px;font-family:${FONT};font-size:12.5px;color:${BRAND.muted};white-space:nowrap;">${escapeHtml(row.label)}</td>
    <td valign="top" align="right" style="${edge}padding:11px 16px 11px 10px;font-family:${FONT};font-size:13.5px;font-weight:600;color:${BRAND.ink};word-break:break-word;">${escapeHtml(row.value)}</td>
  </tr>`;
    })
    .join('\n');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;border:1px solid ${BRAND.hairline};border-radius:10px;">
${cells}
</table>`;
}

export interface AlertInput {
  tone: 'warning' | 'bad';
  title: string;
  body: string;
}

/**
 * For the two emails that carry bad news — a suspension, a rejection.
 *
 * Colour is doing real work here rather than decorating: these are the only templates
 * where the reader needs to register the outcome before reading a word, and the rest
 * of the system's green would actively mislead. `bad` is reserved for a decision that
 * went against them; a hold or a caution is `warning`.
 */
export function alert({ tone, title, body }: AlertInput): string {
  const c =
    tone === 'bad'
      ? { ink: BRAND.badInk, bg: BRAND.badBg, edge: BRAND.badEdge, rule: BRAND.badRule }
      : { ink: BRAND.warnInk, bg: BRAND.warnBg, edge: BRAND.warnEdge, rule: BRAND.warnRule };

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
  <tr><td bgcolor="${c.bg}" style="background:${c.bg};border:1px solid ${c.edge};border-left:3px solid ${c.rule};border-radius:8px;padding:14px 16px;">
    <div style="font-family:${FONT};font-size:13px;font-weight:700;color:${c.ink};margin-bottom:4px;">${escapeHtml(title)}</div>
    <div style="font-family:${FONT};font-size:13px;line-height:1.6;color:${c.ink};">${body}</div>
  </td></tr>
</table>`;
}

/**
 * Names the person on the other end.
 *
 * An affiliate network runs on the manager relationship, and "contact your manager"
 * without a name is an instruction the reader cannot act on.
 */
export function contactCard(name: string, role: string, note: string): string {
  const initial = escapeHtml((name.trim()[0] ?? '?').toUpperCase());
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;border:1px solid ${BRAND.hairline};border-radius:10px;">
  <tr>
    <td width="52" valign="top" style="padding:16px 0 16px 16px;">
      <div style="width:38px;height:38px;line-height:38px;border-radius:19px;background:${BRAND.tintBg};border:1px solid #cdeadb;text-align:center;font-family:${FONT};font-size:15px;font-weight:700;color:${BRAND.green};">${initial}</div>
    </td>
    <td valign="top" style="padding:16px 16px 16px 12px;">
      <div style="font-family:${FONT};font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(role)}</div>
      <div style="font-family:${FONT};font-size:15px;font-weight:600;color:${BRAND.ink};margin-top:3px;">${escapeHtml(name)}</div>
      <div style="font-family:${FONT};font-size:13px;color:${BRAND.muted};line-height:1.55;margin-top:4px;">${escapeHtml(note)}</div>
    </td>
  </tr>
</table>`;
}

export interface Step {
  title: string;
  detail: string;
}

/**
 * A numbered sequence, as one bordered object with divided rows.
 *
 * Numbered because these are genuinely ordered — the reader cannot do the third before
 * the first. Do not reach for this to decorate a list that has no order; a bullet list
 * is the honest shape for that.
 *
 * The border and the dividers are what make it read as a designed block rather than
 * three grey paragraphs with digits in front of them. Two nested tables per row (badge
 * cell, text cell) because Outlook honours neither vertical-align on inline-block nor
 * any form of float.
 */
export function steps(items: Step[]): string {
  const rows = items
    .map((item, index) => {
      const last = index === items.length - 1;
      const edge = last ? '' : `border-bottom:1px solid ${BRAND.hairline};`;
      return `<tr><td style="padding:0;${edge}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td width="30" valign="top" style="padding:14px 0 14px 16px;">
        <div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${BRAND.green};text-align:center;font-family:${FONT};font-size:12px;font-weight:700;color:#ffffff;">${index + 1}</div>
      </td>
      <td valign="top" style="padding:14px 16px 14px 12px;">
        <div style="font-family:${FONT};font-size:14.5px;font-weight:600;color:${BRAND.ink};line-height:1.35;">${escapeHtml(item.title)}</div>
        <div style="font-family:${FONT};font-size:13px;color:${BRAND.muted};line-height:1.55;margin-top:3px;">${escapeHtml(item.detail)}</div>
      </td>
    </tr></table>
  </td></tr>`;
    })
    .join('\n');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;border:1px solid ${BRAND.hairline};border-radius:10px;">
${rows}
</table>`;
}

/**
 * Section heading with a rule running out from it.
 *
 * A bare uppercase caption floated above a block reads as a stray line; the rule ties
 * it to what follows and gives the message a second level of hierarchy under the h1.
 */
export function sectionLabel(text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;">
  <tr>
    <td width="1" style="white-space:nowrap;padding-right:12px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.ink};">${escapeHtml(text)}</td>
    <td style="height:1px;line-height:1px;font-size:0;background:${BRAND.hairline};">&nbsp;</td>
  </tr>
</table>`;
}
