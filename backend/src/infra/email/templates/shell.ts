/**
 * The Fatexia transactional email shell — header, card, footer.
 *
 * Every email the network sends is this, with a template design and the admin's copy
 * dropped into `{{content}}`.
 *
 * ---------------------------------------------------------------------------------
 * RULES FOR EDITING. Email clients are not browsers. Break these and it renders
 * correctly for you and badly for a third of the recipients:
 *
 * 1. Tables for layout. No flexbox, no grid, no float. Outlook renders through Word.
 * 2. Every style inline, on the element. The <style> block below is the one exception
 *    and is additive only: every rule in it is a phone-width override of something
 *    already set inline, so a client that drops the block still renders a correct —
 *    just roomier — email. Never put a style there that the email needs.
 *
 *    Why that exception is safe: the client most likely to ignore <style> is Outlook
 *    on Windows, which has no phone, while the ones that honour it (iOS Mail, Apple
 *    Mail, Gmail app, Outlook.com) are exactly what people read on a handset. Gmail
 *    drops <style> only when it clips a message past ~102KB; ours are ~11KB.
 *
 * 2a. Mobile classes are prefixed `fx-` so they cannot collide with anything a
 *    template design or the admin's pasted copy introduces.
 * 3. No external CSS, no web fonts. Use the FONT stack already on each element.
 * 4. Any coloured <td> needs BOTH bgcolor="..." and style="background:...". Outlook
 *    drops the CSS shorthand and would otherwise leave the cell white.
 * 5. Gradients are decoration only. Always set a solid `background` first as the
 *    fallback, then `background-image` on top.
 * 6. Keep the shell at 600px with max-width:100% — that is the safe width, and the
 *    max-width is what lets it reflow on a phone.
 * 7. Rounded corners degrade to square in Outlook. Fine. Do not fight it.
 *
 * ---------------------------------------------------------------------------------
 * SLOTS. Every one is filled by email-layout.ts. Unknown slots are left untouched,
 * so a typo shows up as visible {{text}} in a test send rather than silently
 * emptying part of the email.
 *
 *   {{subject}}       Message title. HTML-escaped.
 *   {{preheader}}     Inbox preview line. Escaped, hidden in the body.
 *   {{content}}       Template design + the admin's copy. Trusted HTML, not escaped.
 *   {{support_line}}  "Questions? ..." sentence. Trusted HTML, contains a mailto link.
 *   {{footer_nav}}    The portal links row. Trusted HTML.
 *   {{network_name}}  Network name. Escaped.
 *   {{year}}          Current year.
 *   {{logo_url}} {{logo_width}} {{logo_height}}
 *                     Wordmark. The height is derived from the real PNG's aspect
 *                     ratio, so swapping the logo for different proportions does not
 *                     squash it. Both attributes are required — Outlook ignores CSS
 *                     sizing on images and would lay the asset out at full pixel
 *                     width, bursting the 600px shell before the image even loads.
 *
 * COLOURS. Literal hex on purpose: this file is the design, and it should be
 * readable without chasing a constant. Four of them are also in `kit.ts` because the
 * generated blocks need them — change one, change both:
 *
 *   #22b470  brand green   (accent bar, links)     — also BRAND.green
 *   #0f1720  ink           (headings)              — also BRAND.ink
 *   #232f3b  body text                             — also BRAND.text
 *   #6b7a89  muted text                            — also BRAND.muted
 *   #0b0f14  band black    (header + legal strip)  — shell only
 *   #eef1f4  page canvas                           — shell only
 *   #f7f9fa  footer panel                          — shell only
 */
export const EMAIL_SHELL = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{subject}}</title>
<style>
/* Phone overrides. Additive only — see shell.ts for why. */
@media screen and (max-width: 480px) {
  .fx-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .fx-stack { display: block !important; width: 100% !important; text-align: left !important; }
  .fx-stack-gap { padding-top: 14px !important; }
  .fx-logo { width: 132px !important; height: auto !important; }
  .fx-badge { float: none !important; }
  .fx-nav { line-height: 2.4 !important; }
  .fx-code { font-size: 30px !important; letter-spacing: .22em !important; padding-left: .22em !important; }
  .fx-figure { font-size: 34px !important; }
  .fx-status { font-size: 21px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#eef1f4;-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{preheader}}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef1f4;">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;">

      <tr><td class="fx-pad" bgcolor="#0b0f14" style="background:#0b0f14;border-radius:14px 14px 0 0;padding:28px 32px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td class="fx-stack" valign="middle">
            <img class="fx-logo" src="{{logo_url}}" width="{{logo_width}}" height="{{logo_height}}" alt="{{network_name}}"
                 style="display:block;width:{{logo_width}}px;height:{{logo_height}}px;border:0;outline:none;text-decoration:none;">
          </td>
          <td class="fx-stack fx-stack-gap" align="right" valign="middle">
            <table class="fx-badge" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="float:right;"><tr>
              <td bgcolor="#10261c" style="background:#10261c;border:1px solid #1d4a36;border-radius:999px;padding:6px 12px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#4ade9b;white-space:nowrap;">
                Affiliate Network
              </td>
            </tr></table>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="height:3px;line-height:3px;font-size:0;background:#22b470;background-image:linear-gradient(90deg,#12ba9e,#22b470,#6acb2a);">&nbsp;</td></tr>

      <tr><td class="fx-pad" style="background:#ffffff;padding:28px 32px 26px;">
        <h1 style="margin:0 0 20px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:21px;line-height:1.35;font-weight:700;letter-spacing:-.01em;color:#0f1720;">{{subject}}</h1>
        {{content}}
      </td></tr>

      <tr><td class="fx-pad" bgcolor="#f7f9fa" style="background:#f7f9fa;border-top:1px solid #e3e8ed;padding:24px 32px 22px;">
        <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8b98a5;margin:0 0 7px;">Need help?</div>
        <p style="margin:0 0 18px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:13.5px;line-height:1.6;color:#232f3b;">
          {{support_line}}
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">
          <tr><td style="height:1px;line-height:1px;font-size:0;background:#e3e8ed;">&nbsp;</td></tr>
        </table>

        <p class="fx-nav" style="margin:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:13px;line-height:2;">
          {{footer_nav}}
        </p>
      </td></tr>

      <tr><td class="fx-pad" bgcolor="#0b0f14" style="background:#0b0f14;border-radius:0 0 14px 14px;padding:20px 32px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td valign="top" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#4ade9b;padding:0 0 10px;">
            {{network_name}}
          </td>
        </tr><tr>
          <td style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;font-size:11.5px;line-height:1.75;color:#8895a3;">
            &copy; {{year}} {{network_name}}. All rights reserved.<br>
            <span style="color:#6d7a87;">You received this because you have an account with {{network_name}}.</span>
          </td>
        </tr></table>
      </td></tr>

    </table>

  </td></tr>
</table>
</body>
</html>`;
