import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Both routes redirect into the affiliate portal. They stay crawlable (see
        // app/robots.ts) so that this header is the thing that keeps them out of the
        // index; `follow` still lets the crawler walk the redirect target.
        source: '/(login|register)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
      },
    ];
  },
};

export default nextConfig;
