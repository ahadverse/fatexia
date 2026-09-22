import type { ErrorRequestHandler } from 'express';
import { AppError } from './errors';
import { logger } from './logger';

/**
 * The error response for the two tracker routes a human actually lands on.
 *
 * `/click` and `/sl` end in a 302 for a real person in a real browser, so when one of
 * them fails that person sees the response body. The shared JSON handler renders
 * `{"error":"Offer not available"}` as plain text on a white page, which reads as a
 * broken site rather than as an expired link — and the affiliate who sent the traffic
 * gets blamed for it.
 *
 * Deliberately not mounted on `/postback` or `/internal/geoip`. Those are consumed by an
 * advertiser's server and by our own API, both of which parse the JSON body; handing
 * them HTML would turn a readable error into a parse failure.
 */

// One message for every failure, whatever the internal reason.
//
// The three AppErrors that reach here — "Offer not available", "Smart-link not
// available", "No offer available for this smart-link" — differ in ways that matter to
// an operator reading logs and not at all to the visitor, who can act on none of them.
// Collapsing them also avoids telling an unknown caller which of a tracking link's parts
// exists, which is the same reasoning `/postback` uses for its single generic rejection.
const TITLE = 'Offer not available';
const BODY = 'This link is no longer active. If someone sent you here, please ask them for an updated link.';

function page(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${TITLE}</title>
<style>
  :root { color-scheme: light dark; --bg: #ffffff; --fg: #18181b; --muted: #71717a; --card: #fafafa; --line: #e4e4e7; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #09090b; --fg: #fafafa; --muted: #a1a1aa; --card: #18181b; --line: #27272a; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: var(--bg); color: var(--fg);
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  main { width: 100%; max-width: 420px; text-align: center; background: var(--card);
         border: 1px solid var(--line); border-radius: 12px; padding: 32px 24px; }
  h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0; color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
  <main>
    <h1>${TITLE}</h1>
    <p>${BODY}</p>
  </main>
</body>
</html>`;
}

export const visitorErrorPage: ErrorRequestHandler = (err, _req, res, _next) => {
  // A 5xx is still a page for the visitor, but it is also still an incident: keep the
  // logging the shared handler does, or an unexpected tracker failure becomes invisible
  // the moment it is dressed up as a tidy page.
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  if (!(err instanceof AppError)) {
    logger.error({ err }, 'Unhandled error on a visitor-facing tracker route');
  }

  res.status(statusCode).type('html').send(page());
};
