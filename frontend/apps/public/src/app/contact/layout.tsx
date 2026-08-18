import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { CONTACT_EMAIL, ORGANIZATION_ID, absoluteUrl, breadcrumbSchema, pageMetadata } from '@/lib/seo';

/**
 * The contact page itself is a client component (it owns the form state), and a client
 * component cannot export `metadata`. This layout exists purely to attach the route's
 * SEO signals — it wraps only /contact, so nothing else inherits them.
 */
export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description:
    'Talk to a real person at Fatexia — affiliate applications, listing an offer as an advertiser, or anything else. Replies come from a human, not a ticket queue.',
  path: '/contact',
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([{ name: 'Contact', path: '/contact' }]),
          {
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            url: absoluteUrl('/contact'),
            name: 'Contact Fatexia',
            mainEntity: { '@id': ORGANIZATION_ID },
            about: { '@id': ORGANIZATION_ID },
            email: CONTACT_EMAIL,
          },
        ]}
      />
      {children}
    </>
  );
}
