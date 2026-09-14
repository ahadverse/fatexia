/**
 * What a per-email template design is handed, and what it must give back.
 *
 * Separate from `index.ts` because the designs import these types and `index.ts`
 * imports the designs — putting both in one module makes a cycle.
 */

export interface TemplateContext {
  /**
   * The admin's own copy for this email, with macros already substituted and the text
   * already rendered into HTML blocks (paragraphs, bullet lists, the verification-code
   * panel, buttons).
   *
   * A design places this; it does not rewrite it. The wording stays editable from
   * Emails → Templates in the admin panel, which is the whole reason the copy is not
   * in these files.
   */
  content: string;
  /**
   * Macro values for this specific send — `affiliate_name`, `code`, `amount`, and
   * whatever else the trigger passed, plus `network_name` and `support_email`.
   *
   * Raw and unescaped: a design that interpolates one into markup must run it through
   * `escapeHtml` from the kit first.
   */
  macros: Record<string, string>;
  /** Resolved network name, already HTML-escaped. */
  networkName: string;
  /** Affiliate portal base URL, no trailing slash. */
  portalUrl: string;
}

export interface TemplateDesign {
  /**
   * Returns the full `{{content}}` region of the shell.
   *
   * Must include `ctx.content` somewhere, or the admin's copy silently vanishes from
   * that email — the design decides where it sits, not whether it appears.
   */
  render(ctx: TemplateContext): string;
}
