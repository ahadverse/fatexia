'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X, ArrowRight } from 'lucide-react';

const PRIMARY_LINKS = [
  { href: '/affiliates', label: 'For Affiliates' },
  { href: '/advertisers', label: 'For Advertisers' },
];

const NETWORK_LINKS = [
  { href: '/verticals', label: 'Verticals', desc: 'Every category we run traffic on' },
  { href: '/payments', label: 'Payments', desc: 'Payout methods, terms & currencies' },
  { href: '/faq', label: 'FAQ', desc: 'Answers to the common questions' },
];

const SECONDARY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center">
      {/* Plain <img>, not next/image: the wordmark is a small fixed-size asset, so the
          optimiser buys nothing and would only add a loader hop. */}
      <img src="/logo.png" alt="Fatexia" className="h-8 w-auto" />
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Network dropdown */}
          <div className="relative" onMouseEnter={() => setNetworkOpen(true)} onMouseLeave={() => setNetworkOpen(false)}>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={networkOpen}
            >
              Network
              <ChevronDown className={`size-4 transition-transform ${networkOpen ? 'rotate-180' : ''}`} />
            </button>
            {networkOpen && (
              <div className="absolute left-0 top-full w-72 pt-2">
                <div className="overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-2xl">
                  {NETWORK_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
                    >
                      <div className="text-sm font-semibold text-foreground">{link.label}</div>
                      <div className="text-xs text-muted-foreground">{link.desc}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {SECONDARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_28px_-8px_hsl(150_75%_38%/0.8)] transition-all hover:brightness-110"
          >
            Become an Affiliate
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-md border border-border text-foreground lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="container-page flex flex-col gap-1 py-4">
            {[...PRIMARY_LINKS, ...NETWORK_LINKS, ...SECONDARY_LINKS].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-md border border-border px-4 py-2.5 text-center text-sm font-semibold text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="rounded-md bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
              >
                Become an Affiliate
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
