import Script from 'next/script';

// A GA4 measurement id is public by design — it ships in the client bundle on every
// page, so there is nothing here that keeping it out of source would protect.
const GA_MEASUREMENT_ID = 'G-RFPDHC1LFQ';

/**
 * Google Analytics 4.
 *
 * `beforeInteractive`, not `afterInteractive`, for one specific reason: Search Console's
 * "Google Analytics" ownership check reads the *initial* HTML and requires the snippet
 * inside `<head>`. `afterInteractive` injects into `<body>` after hydration, which
 * measures traffic perfectly well but fails that check with "the tracking code on your
 * site is in the wrong location on the page". Next puts `beforeInteractive` scripts in
 * the head of the served document, where the verifier looks.
 *
 * This costs a little: the tag is fetched before the page becomes interactive rather
 * than after. Only the root layout may declare it, which is where it sits.
 *
 * Only the public marketing site mounts this. The admin and affiliate portals sit
 * behind a login, where the page views are operators working rather than an audience.
 */
export function Analytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="beforeInteractive" />
      <Script id="ga-init" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
