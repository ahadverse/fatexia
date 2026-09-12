import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider, Toaster } from '@fatexia/ui';
import '@fatexia/ui/styles/theme.css';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { DotRain } from '@/components/DotRain';
import { BackToTop } from '@/components/BackToTop';
import { JsonLd } from '@/components/JsonLd';
import { Analytics } from '@/components/Analytics';
import { SITE_NAME, SITE_URL, organizationSchema, websiteSchema } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Note: no `alternates.canonical` here on purpose. Next inherits metadata from parent
// segments, so a canonical set at the root would be handed to every page that does not
// override it — telling Google that /faq, /payments and the rest are all duplicates of
// the home page. Each route declares its own via `pageMetadata` in @/lib/seo.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Fatexia — The CPA Network Built on Transparent Tracking',
    template: '%s — Fatexia',
  },
  description:
    'Fatexia is a CPA affiliate network with an in-house click tracker, layered no-cost fraud detection, and payouts computed from the rule every time. Built for affiliates and advertisers who want a network that shows its work.',
  keywords: ['CPA network', 'affiliate network', 'affiliate marketing', 'CPA offers', 'performance marketing', 'affiliate payouts'],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'marketing',
  verification: {
    google: 'kn_FpdyM29NGPgKW6TldIxN5eFzHEluwc-zR0MHbXyk',
  },
  // `max-image-preview: large` is what lets the Open Graph card show up as a full-width
  // thumbnail in Google results instead of a thumbnail-sized crop; the snippet limits
  // are set to unlimited so Google, not a truncation rule, decides how much to show.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    url: SITE_URL,
    title: 'Fatexia — The CPA Network Built on Transparent Tracking',
    description: 'In-house tracking, layered fraud detection, and payouts you can verify. One network, built well.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fatexia — The CPA Network Built on Transparent Tracking',
    description: 'In-house tracking, layered fraud detection, and payouts you can verify. One network, built well.',
  },
  // Phone-number autolinking rewrites numeric copy (IDs, payout figures) into tel:
  // links on iOS and changes how the page renders; the site has no phone numbers.
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-background font-sans text-foreground antialiased">
        <Analytics />
        {/* Site-wide graph nodes. Page-level schemas reference these by @id rather than
            redeclaring the organisation on every route. */}
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <ThemeProvider>
          <DotRain />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <BackToTop />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
