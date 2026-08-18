import { ImageResponse } from 'next/og';

/**
 * The social card for every route.
 *
 * Placed at the app root so Next inherits it into every nested segment — file-based
 * images take precedence over config-based `openGraph.images`, which is why
 * `pageMetadata` never sets images itself. Generated rather than shipped as a static
 * PNG so it always matches the brand colours in globals.css and needs no design asset
 * to be kept in sync.
 */
export const alt = 'Fatexia — the CPA network built on transparent tracking';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// hsl(152 68% 42%), the --primary override the public site applies in globals.css.
const BRAND = '#22b470';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#080b0a',
          // Satori has no radial-gradient support in `background`, so the brand glow is
          // a linear wash instead of the radial one the site uses.
          backgroundImage: `linear-gradient(135deg, ${BRAND}22 0%, #080b0a 55%)`,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: BRAND }} />
          <div style={{ fontSize: 34, color: BRAND, letterSpacing: 6, fontWeight: 700 }}>FATEXIA</div>
        </div>

        <div style={{ marginTop: 34, fontSize: 74, lineHeight: 1.08, color: '#f5f7f6', fontWeight: 700, maxWidth: 940 }}>
          The CPA network built on transparent tracking
        </div>

        <div style={{ marginTop: 30, fontSize: 30, lineHeight: 1.4, color: '#9aa5a1', maxWidth: 900 }}>
          In-house click tracker · layered fraud detection · payouts computed from the rule
        </div>

        <div style={{ marginTop: 46, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 60, height: 4, background: BRAND }} />
          <div style={{ fontSize: 26, color: '#6f7a76' }}>fatexia.com</div>
        </div>
      </div>
    ),
    size,
  );
}
