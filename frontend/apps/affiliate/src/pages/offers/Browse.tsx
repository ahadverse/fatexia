import { useState } from 'react';
import {
  Button,
  DataTable,
  ExternalLinkButton,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  CountryFlag,
  RichText,
  TrafficSourceList,
  Select,
  TableSkeleton,
  toast,
  type DataTableColumn,
} from '@fatexia/ui';
import type { AffiliateOffer } from '@fatexia/types';
import { getAvailableOffers } from '../../lib/offers-api';
import { useAsync } from '../../hooks/useAsync';
import { money } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

// Real data from GET /offers/available — payout-only (the projection has no revenue
// field at all). `trackingLink` arrives with this affiliate's own id already
// substituted server-side, so Copy Link yields a working URL.
export function Browse() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState<AffiliateOffer | null>(null);

  const offers = useAsync<AffiliateOffer[]>(() => getAvailableOffers(), []);
  const rows = (offers.data ?? []).filter((offer) => {
    if (category && offer.category !== category) return false;
    if (!search) return true;
    const haystack = `${offer.name} ${offer.advertiserName ?? ''} ${offer.category ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const categories = [...new Set((offers.data ?? []).flatMap((offer) => (offer.category ? [offer.category] : [])))].sort();

  function copyLink(offer: AffiliateOffer) {
    void navigator.clipboard.writeText(offer.trackingLink);
    toast.success('Tracking link copied');
  }

  const columns: DataTableColumn<AffiliateOffer>[] = [
    {
      key: 'name',
      header: 'Offer',
      render: (offer) => (
        <button type="button" onClick={() => setDetail(offer)} className="flex items-center gap-2.5 text-left">
          {/* Thumbnail was uploadable on the admin side and rendered nowhere. A tinted
              initial stands in when an offer has none, so rows keep a single shape. */}
          {offer.iconUrl ? (
            <img src={offer.iconUrl} alt="" className="size-9 shrink-0 rounded-md border border-border object-cover" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
              {offer.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          {/* No advertiser name: which advertiser is behind an offer is the network's
              commercial relationship, not something an affiliate runs traffic against. */}
          <p className="min-w-0 font-medium text-card-foreground hover:underline">
            {offer.featured && <span className="mr-1.5 text-xs text-primary">Featured</span>}
            {offer.name}
          </p>
        </button>
      ),
    },
    { key: 'category', header: 'Category', render: (offer) => offer.category ?? '—' },
    {
      key: 'payout',
      header: 'Payout',
      render: (offer) =>
        offer.payoutRules[0]
          ? `${money(offer.payoutRules[0].amount, offer.currency)} / ${offer.payoutRules[0].payoutMode}`
          : '—',
    },
    {
      key: 'geo',
      header: 'Geo',
      render: (offer) => {
        const countries = offer.payoutRules[0]?.countries ?? [];
        if (countries.length === 0) return 'All';
        return (
          <div className="flex flex-wrap items-center gap-1">
            {countries.map((code) => (
              <span key={code} className="flex items-center gap-1 text-xs">
                <CountryFlag code={code} title={code} />
                {code}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'traffic',
      header: 'Traffic',
      render: (offer) => <TrafficSourceList allowed={offer.trafficTypes} disallowed={offer.disallowedTrafficTypes} emptyMessage="Any" />,
    },
    { key: 'status', header: 'Status', render: (offer) => <StatusPill status={offer.status} /> },
    {
      key: 'link',
      header: '',
      render: (offer) => (
        <div className="flex justify-end gap-1.5">
          <ExternalLinkButton href={offer.trackingLink} label="Open tracking link in new tab" />
          <Button size="sm" variant="outline" onClick={() => copyLink(offer)}>
            Copy link
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Browse offers"
        description="Every offer you can run right now. Copy a tracking link to start sending traffic."
      />

      <FilterBar>
        <FilterField label="Search">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Offer or advertiser"
            className="w-56"
          />
        </FilterField>
        <FilterField label="Category">
          <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-48">
            <option value="">All categories</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {offers.error && <p className="text-sm text-destructive">{offers.error}</p>}

      {offers.loading ? (
        <TableSkeleton columns={7} />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(offer) => offer.id} emptyMessage="No offers match these filters." />
      )}

      <Modal open={!!detail} onOpenChange={(open) => !open && setDetail(null)} title={detail?.name ?? 'Offer'} className="max-w-2xl">
        {detail && (
          <div className="space-y-4 text-sm">
            {detail.iconUrl && (
              <img src={detail.iconUrl} alt="" className="h-24 w-full rounded-md border border-border object-cover" />
            )}

            {(detail.payoutRules[0]?.countries.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Countries</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {detail.payoutRules[0]!.countries.map((code) => (
                    <span
                      key={code}
                      className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    >
                      <CountryFlag code={code} title={code} />
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ['Category', detail.category ?? '—'],

                ['Deep linking', detail.allowDeepLinking ? 'Allowed' : 'Not allowed'],
                [
                  'Payout',
                  detail.payoutRules[0]
                    ? `${money(detail.payoutRules[0].amount, detail.currency)} / ${detail.payoutRules[0].payoutMode}`
                    : '—',
                ],
                [
                  'Hold',
                  detail.payoutRules[0]?.holdSchedule.enabled
                    ? `${detail.payoutRules[0].holdSchedule.days} days after approval`
                    : 'No hold',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-card-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Prominent, not a row in the grid above: sending a forbidden source is
                how an affiliate gets a batch of conversions voided, so it should be
                readable before they copy the link rather than after. */}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Traffic sources</p>
              <TrafficSourceList
                allowed={detail.trafficTypes}
                disallowed={detail.disallowedTrafficTypes}
                emptyMessage="No traffic restrictions stated — check with your manager before running anything unusual."
                className="mt-1"
              />
            </div>

            {detail.kpi && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">What counts as a conversion</p>
                <p className="mt-0.5 text-card-foreground">{detail.kpi}</p>
              </div>
            )}
            {detail.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <RichText html={detail.description} className="mt-0.5 text-muted-foreground" />
              </div>
            )}
            {detail.remarksForAffiliateManager && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Notes from your manager</p>
                <p className="mt-0.5 text-muted-foreground">{detail.remarksForAffiliateManager}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground">Your tracking link</p>
              <p className="mt-1 break-all rounded-md border border-border bg-background p-2 font-mono text-xs">
                {detail.trackingLink}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              {detail.previewLink && (
                <a
                  href={detail.previewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-accent"
                >
                  Preview landing page
                </a>
              )}
              <ExternalLinkButton href={detail.trackingLink} label="Open tracking link in new tab" />
              <Button onClick={() => copyLink(detail)}>Copy tracking link</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
