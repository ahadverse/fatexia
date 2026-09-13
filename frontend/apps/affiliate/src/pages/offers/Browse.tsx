import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, CheckCircle2, Eye, Lock } from 'lucide-react';
import {
  Button,
  DataTable,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  CountryFlag,
<<<<<<< HEAD
=======
  RichText,
  TrafficSourceList,
>>>>>>> 9d481ff06ca31d0842066c6061ea1fe97ba18db1
  Select,
  TableSkeleton,
  Textarea,
  toast,
  type DataTableColumn,
} from '@fatexia/ui';
import type { AffiliateOffer } from '@fatexia/types';
import { getAvailableOffers, setOfferFavourite } from '../../lib/offers-api';
import { requestOfferAccess } from '../../lib/portal-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { percent, money } from '../../lib/format';
import { payoutLabels, payoutModes, targetingUnion } from '../../lib/offer-display';

/**
 * A targeting cell — countries, devices or operating systems.
 *
 * "All" is the honest label for an empty list: no restriction on that field means the
 * offer takes everything, and a blank cell would read as missing data. Countries carry
 * their flag because a row of ISO codes is unscannable at ten offers a screen.
 */
function TargetingCell({ values, flags = false }: { values: string[]; flags?: boolean }) {
  if (values.length === 0) return <span className="text-muted-foreground">All</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {values.map((value) =>
        flags ? (
          <CountryFlag key={value} code={value} title={value} />
        ) : (
          <span key={value} className="text-xs capitalize text-primary">
            {value}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * The access cell — one control per state, never two.
 *
 * A locked offer shows the ask, not the link: the tracker takes a click at face value,
 * so a copyable link on an unapproved offer would make the approval step decorative.
 * Pending is the one read-only state — the decision is with the manager and there is
 * nothing to press. A rejection is not final: the server resets the existing row back
 * to PENDING on a second ask (see offerAccessRequestService.createRequest), which is
 * what an affiliate who has since changed traffic source needs, so the cell keeps a way
 * to ask again next to the verdict.
 */
// A pill sits on one line and centres what is in it. Without the nowrap, a two-word
// label wraps inside the rounded shape at a narrow column width and then sets itself
// ragged-left, which reads as a rendering fault rather than a status.
const PILL = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium';

function AccessCell({ offer, onRequest }: { offer: AffiliateOffer; onRequest: (offer: AffiliateOffer) => void }) {
  if (offer.access === 'GRANTED') {
    return (
      <span className={`${PILL} bg-success/15 text-success`}>
        <CheckCircle2 className="size-3.5" />
        Approved
      </span>
    );
  }

  if (offer.access === 'PENDING') {
    return <span className={`${PILL} bg-warning/15 text-warning`}>Awaiting approval</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {offer.access === 'REJECTED' && <span className={`${PILL} bg-destructive/15 text-destructive`}>Not approved</span>}
      <button type="button" onClick={() => onRequest(offer)} className={`${PILL} bg-primary/10 text-primary hover:bg-primary/20`}>
        <Lock className="size-3" />
        {offer.access === 'REJECTED' ? 'Ask again' : 'Request access'}
      </button>
    </div>
  );
}

/**
 * The offer catalogue: every live offer, gated ones included.
 *
 * A row is a decision aid, not a workspace. It carries what an affiliate scans to pick
 * an offer — geo, devices, OS, what it converts at, what it pays — and stops there. The
 * tracking link, the traffic-source rules and the brief live on the detail page, one
 * click away, because they are what you read once you have chosen rather than what you
 * choose by. That also keeps the link off a screen that lists offers nobody has been
 * approved for.
 */
export function Browse() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [requesting, setRequesting] = useState<AffiliateOffer | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  // Bookmarks applied locally the moment they are clicked. A reload of the whole
  // catalogue to repaint one icon would make the click feel broken on a long list; the
  // server is still the authority, and a failure reverts below.
  const [favourites, setFavourites] = useState<Record<string, boolean>>({});

  const offers = useAsync<AffiliateOffer[]>(() => getAvailableOffers(), []);

  function isFavourite(offer: AffiliateOffer): boolean {
    return favourites[offer.id] ?? offer.favourite;
  }

  async function toggleFavourite(offer: AffiliateOffer) {
    const next = !isFavourite(offer);
    setFavourites((current) => ({ ...current, [offer.id]: next }));
    try {
      await setOfferFavourite(offer.id, next);
    } catch (err) {
      setFavourites((current) => ({ ...current, [offer.id]: !next }));
      toast.error(err instanceof Error ? err.message : 'Could not save the bookmark');
    }
  }

  const rows = (offers.data ?? []).filter((offer) => {
    if (onlyFavourites && !isFavourite(offer)) return false;
    if (category && offer.category !== category) return false;
    if (!search) return true;
    // The offer number is searchable because it is what an affiliate is given in a
    // message — "run 100042" should find the row without them translating it to a name.
    const haystack = `${offer.name} ${offer.category ?? ''} ${offer.refId} ${offer.networkOfferId ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const categories = [...new Set((offers.data ?? []).flatMap((offer) => (offer.category ? [offer.category] : [])))].sort();

  async function submitRequest() {
    if (!requesting) return;
    setSaving(true);
    const result = await runAction(() => requestOfferAccess(requesting.id, note.trim() || undefined), {
      success: 'Request sent — your manager will review it',
      onDone: offers.reload,
    });
    setSaving(false);
    if (result) {
      setRequesting(null);
      setNote('');
    }
  }

  const columns: DataTableColumn<AffiliateOffer>[] = [
    {
      key: 'image',
      header: 'Image',
      className: 'w-20',
      render: (offer) =>
        /* Thumbnail was uploadable on the admin side and rendered nowhere. A tinted
           initial stands in when an offer has none, so rows keep a single shape. Big
           enough that a creative is actually legible — the artwork is half of how an
           affiliate recognizes an offer in a long list. */
        offer.iconUrl ? (
          <img src={offer.iconUrl} alt="" className="size-16 rounded-lg border border-border object-cover" />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-lg bg-primary/10 text-base font-semibold text-primary">
            {offer.name.slice(0, 2).toUpperCase()}
          </span>
        ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (offer) => (
<<<<<<< HEAD
        <div className="space-y-1">
          {/* Only a granted offer opens. The row is as far as a gated one goes — the
              server refuses the detail page for it (see offerService.getAvailableOffer),
              so a link here would lead to an error. What the affiliate needs in order to
              decide is already in the row; the Status cell is where they ask. */}
          <button
            type="button"
            onClick={() => navigate(`/offers/${offer.id}`)}
            disabled={offer.access !== 'GRANTED'}
            className="text-left font-medium text-card-foreground enabled:hover:text-primary enabled:hover:underline disabled:cursor-default"
          >
=======
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
>>>>>>> 9d481ff06ca31d0842066c6061ea1fe97ba18db1
            {offer.featured && <span className="mr-1.5 text-xs text-primary">Featured</span>}
            {/* The offer number, in front of the name where every network puts it — it
                is what a message to a manager quotes and what the tracking link carries. */}
            <span className="mr-1 text-muted-foreground">({offer.refId})</span>
            {offer.name}
<<<<<<< HEAD
            {offer.access !== 'GRANTED' && (
              <Lock className="ml-1.5 inline size-3 text-muted-foreground" aria-label="Access required" />
            )}
          </button>
          {offer.category && (
            <span className="inline-flex rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
              {offer.category}
            </span>
          )}
        </div>
=======
          </p>
        </button>
>>>>>>> 9d481ff06ca31d0842066c6061ea1fe97ba18db1
      ),
    },
    {
      key: 'countries',
      header: 'Countries',
      render: (offer) => <TargetingCell values={targetingUnion(offer, 'countries')} flags />,
    },
    { key: 'devices', header: 'Devices', render: (offer) => <TargetingCell values={targetingUnion(offer, 'devices')} /> },
    {
      key: 'os',
      header: 'Operating systems',
      render: (offer) => <TargetingCell values={targetingUnion(offer, 'os')} />,
    },
    {
      key: 'cr',
      header: 'CR / EPC',
      // Network-wide, last 30 days — everyone's traffic, which is what makes it useful
      // for an offer this affiliate has never run. Null means no clicks in the window,
      // shown as a dash: a 0.00% there would read as "does not convert".
      render: (offer) =>
        offer.conversionRate === null && offer.epc === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="text-xs">
            <p className="text-muted-foreground">
              CR <span className="font-medium text-card-foreground">{percent(offer.conversionRate ?? 0)}</span>
            </p>
            <p className="text-muted-foreground">
              EPC <span className="font-medium text-success">{money(offer.epc ?? 0, offer.currency)}</span>
            </p>
          </div>
        ),
    },
    {
      key: 'model',
      // "Model", not "Goal": the schema has no named goals, and what an affiliate is
      // paid for is exactly the payout mode (see payoutModes).
      header: 'Model',
      render: (offer) => {
<<<<<<< HEAD
        const modes = payoutModes(offer);
        return modes.length === 0 ? <span className="text-muted-foreground">—</span> : <span>{modes.join(', ')}</span>;
=======
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
>>>>>>> 9d481ff06ca31d0842066c6061ea1fe97ba18db1
      },
    },
    {
      key: 'payout',
      header: 'Payout',
      render: (offer) => {
        const labels = payoutLabels(offer);
        if (labels.length === 0) return <span className="text-muted-foreground">—</span>;
        return <span className="font-medium text-success">{labels.join(' / ')}</span>;
      },
    },
    { key: 'status', header: 'Status', render: (offer) => <AccessCell offer={offer} onRequest={setRequesting} /> },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (offer) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => toggleFavourite(offer)}
            aria-pressed={isFavourite(offer)}
            aria-label={isFavourite(offer) ? 'Remove bookmark' : 'Bookmark this offer'}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Bookmark className={`size-4 ${isFavourite(offer) ? 'fill-primary text-primary' : ''}`} />
          </button>
          {/* Absent, not disabled, on a gated offer: a greyed eye invites a click that
              can never work, and the Status cell already says what to do instead. */}
          {offer.access === 'GRANTED' && (
            <button
              type="button"
              onClick={() => navigate(`/offers/${offer.id}`)}
              aria-label="View offer details"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Eye className="size-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Browse offers"
        description="Every offer on the network. Open one for its tracking link and traffic rules, or request access to the ones that need approval."
      />

      <FilterBar>
        <FilterField label="Search">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Offer, id or category"
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
        <FilterField label="Bookmarks">
          <Button variant={onlyFavourites ? 'primary' : 'outline'} onClick={() => setOnlyFavourites((value) => !value)}>
            <Bookmark className={`mr-1.5 size-3.5 ${onlyFavourites ? 'fill-current' : ''}`} />
            Bookmarked only
          </Button>
        </FilterField>
      </FilterBar>

      {offers.error && <p className="text-sm text-destructive">{offers.error}</p>}

      {offers.loading ? (
        <TableSkeleton columns={10} />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(offer) => offer.id} emptyMessage="No offers match these filters." />
      )}

<<<<<<< HEAD
      <Modal
        open={!!requesting}
        onOpenChange={(open) => {
          if (!open) {
            setRequesting(null);
            setNote('');
          }
        }}
        title={requesting ? `Request access — ${requesting.name}` : 'Request access'}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your manager decides who runs this offer. Say where the traffic comes from and they can answer faster.
          </p>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Tell your manager about your traffic</span>
            <Textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Source, geos, expected daily volume — the more specific, the faster the decision."
              className="mt-1"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRequesting(null)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={submitRequest}>
              {saving ? 'Sending…' : 'Send request'}
            </Button>
=======
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
>>>>>>> 9d481ff06ca31d0842066c6061ea1fe97ba18db1
          </div>
        </div>
      </Modal>
    </div>
  );
}
