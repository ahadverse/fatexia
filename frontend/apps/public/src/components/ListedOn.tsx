'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { LISTING_SITES } from '@/lib/content';

/**
 * Directory listings, shown as outbound cards.
 *
 * A client component only because of the image fallback: the logo files are dropped
 * in by hand, and until they exist `onError` swaps in a typeset wordmark so the row
 * never shows a broken-image icon. Everything else here is static.
 */
function BrandLogo({ name, logo }: { name: string; logo: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="text-lg font-bold tracking-tight text-foreground">{name}</span>;
  }

  return (
    <img
      src={logo}
      alt={name}
      // Height-constrained, width-auto: the three logos have different aspect ratios,
      // and forcing a common box would letterbox or squash whichever doesn't match.
      className="h-8 w-auto max-w-[160px] object-contain object-left opacity-90 transition-opacity group-hover:opacity-100"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

export function ListedOn() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {LISTING_SITES.map((site) => (
        <a
          key={site.name}
          href={site.href}
          target="_blank"
          // noopener for the tabnabbing protection, nofollow because these are
          // directory listings rather than editorial endorsements.
          rel="noopener noreferrer nofollow"
          className="group relative flex flex-col rounded-2xl border border-white/10 bg-card/60 p-6 transition-colors hover:border-primary/40"
        >
          <div className="flex h-10 items-center">
            <BrandLogo name={site.name} logo={site.logo} />
          </div>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{site.blurb}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            View our listing
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </a>
      ))}
    </div>
  );
}
