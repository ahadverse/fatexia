import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

/**
 * Nothing is disallowed on purpose.
 *
 * `/login` and `/register` are redirect shims into the affiliate portal and should not
 * be indexed, but blocking them here would be the wrong tool: a robots.txt disallow
 * stops the crawl without stopping the *indexing*, which is how a URL ends up listed as
 * "indexed, though blocked by robots.txt" with no snippet. They are kept crawlable and
 * carry an `X-Robots-Tag: noindex` response header instead (see next.config.ts), which
 * Google can only act on if it is allowed to fetch them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
