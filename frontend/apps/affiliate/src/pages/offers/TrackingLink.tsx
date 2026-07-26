import { useState } from 'react';
import { Button, Input, PageHeader, Select, Skeleton, toast } from '@fatexia/ui';
import type { AffiliateOffer } from '@fatexia/types';
import { getAvailableOffers } from '../../lib/offers-api';
import { useAsync } from '../../hooks/useAsync';

/**
 * Builds a ready-to-use tracking link for one offer.
 *
 * The base link comes from the API with this affiliate's own id already substituted
 * server-side; this page only appends the optional sub-id parameters, which the
 * tracker stores on the click and every report can then break down by.
 */
export function TrackingLink() {
  const offers = useAsync<AffiliateOffer[]>(() => getAvailableOffers(), []);
  const [offerId, setOfferId] = useState('');
  const [sub1, setSub1] = useState('');
  const [sub2, setSub2] = useState('');
  const [sub3, setSub3] = useState('');

  const rows = offers.data ?? [];
  const selected = rows.find((offer) => offer.id === offerId) ?? rows[0] ?? null;

  const link = (() => {
    if (!selected) return '';
    const url = new URL(selected.trackingLink);
    // Only set the params the affiliate actually filled in — an empty `sub1=` would
    // be stored as a real (blank) value and show up as its own row in the report.
    if (sub1.trim()) url.searchParams.set('sub1', sub1.trim());
    if (sub2.trim()) url.searchParams.set('sub2', sub2.trim());
    if (sub3.trim()) url.searchParams.set('sub3', sub3.trim());
    return url.toString();
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking link"
        description="Build the link you place in your campaign. Sub-IDs are optional labels you can break your reports down by."
      />

      {offers.loading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No offers are available to you yet.</p>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Offer</span>
                <Select value={selected?.id ?? ''} onChange={(event) => setOfferId(event.target.value)} className="mt-1">
                  {rows.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Sub ID 1</span>
                <Input value={sub1} onChange={(event) => setSub1(event.target.value)} placeholder="fb_camp_01" className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Sub ID 2</span>
                <Input value={sub2} onChange={(event) => setSub2(event.target.value)} placeholder="creative_3" className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Sub ID 3</span>
                <Input value={sub3} onChange={(event) => setSub3(event.target.value)} placeholder="placement_a" className="mt-1" />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-card-foreground">Your link</h2>
            <p className="mt-3 break-all rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground">
              {link}
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success('Tracking link copied');
                }}
              >
                Copy link
              </Button>
            </div>
          </section>

          {selected?.allowDeepLinking && (
            <p className="text-xs text-muted-foreground">
              This offer allows deep linking — you can add your own destination path to the link if you need to send traffic
              to a specific page.
            </p>
          )}
        </>
      )}
    </div>
  );
}
