import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider, Toaster } from '@fatexia/ui';
import '@fatexia/ui/styles/theme.css';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { DotRain } from '@/components/DotRain';
import { BackToTop } from '@/components/BackToTop';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fatexia.com'),
  title: {
    default: 'Fatexia — The CPA Network Built on Transparent Tracking',
    template: '%s — Fatexia',
  },
  description:
    'Fatexia is a CPA affiliate network with an in-house click tracker, layered no-cost fraud detection, and payouts computed from the rule every time. Built for affiliates and advertisers who want a network that shows its work.',
  keywords: ['CPA network', 'affiliate network', 'affiliate marketing', 'CPA offers', 'performance marketing', 'affiliate payouts'],
  verification: {
    google: 'kn_FpdyM29NGPgKW6TldIxN5eFzHEluwc-zR0MHbXyk',
  },
  openGraph: {
    type: 'website',
    siteName: 'Fatexia',
    title: 'Fatexia — The CPA Network Built on Transparent Tracking',
    description: 'In-house tracking, layered fraud detection, and payouts you can verify. One network, built well.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-background font-sans text-foreground antialiased">
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
