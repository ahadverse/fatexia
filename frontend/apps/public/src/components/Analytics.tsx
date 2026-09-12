import Script from 'next/script';

// A GA4 measurement id is public by design — it ships in the client bundle on every
// page, so there is nothing here that keeping it out of source would protect.
const GA_MEASUREMENT_ID = 'G-RFPDHC1LFQ';

/**
 * Google Analytics 4.
 *
 * `afterInteractive` rather than `beforeInteractive`: analytics is not needed to render
 * the page, and loading it first delays the content the visitor came for. Next injects
 * it right after hydration, which is early enough to record the landing page view.
 *
 * Only the public marketing site mounts this. The admin and affiliate portals sit
 * behind a login, where the page views are operators working rather than an audience.
 */
export function Analytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
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
