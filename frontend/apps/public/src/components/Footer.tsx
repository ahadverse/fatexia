import Link from 'next/link';
import { ButtonLink } from './marketing';

const FOOTER_COLUMNS = [
  {
    title: 'Network',
    links: [
      { href: '/affiliates', label: 'For Affiliates' },
      { href: '/advertisers', label: 'For Advertisers' },
      { href: '/verticals', label: 'Verticals' },
      { href: '/payments', label: 'Payments' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/blog', label: 'Blog' },
      { href: '/contact', label: 'Contact' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { href: '/register', label: 'Become an Affiliate' },
      { href: '/login', label: 'Sign in' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/cookies', label: 'Cookie Policy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-background">
      {/* CTA strip */}
      <div className="container-page py-14">
        <div className="ring-gradient relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 sm:px-10 md:flex-row md:items-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl"
            style={{ background: 'radial-gradient(500px circle at 20% 120%, hsl(var(--primary) / 0.25), transparent 70%)' }}
          />
          <div>
            <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Ready to run traffic that pays out?</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Applications are reviewed manually. Tell us about your traffic and we&apos;ll get you set up.</p>
          </div>
          <ButtonLink href="/register" size="lg" withArrow className="shrink-0">
            Become an Affiliate
          </ButtonLink>
        </div>
      </div>

      {/* Link columns */}
      <div className="container-page pb-12">
        <div className="grid grid-cols-2 gap-8 border-t border-border pt-12 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <img src="/logo.png" alt="Fatexia" className="h-7 w-auto" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A CPA affiliate network built on an in-house tracker, layered no-cost fraud detection, and payouts you can verify.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-foreground">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Fatexia. All rights reserved.</p>
          <p className="text-xs">Built on infrastructure we own — not infrastructure we rent.</p>
        </div>
      </div>
    </footer>
  );
}
