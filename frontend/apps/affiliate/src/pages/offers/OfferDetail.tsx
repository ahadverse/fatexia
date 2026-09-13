import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  CalendarClock,
  ExternalLink,
  Gauge,
  Globe2,
  Link2,
  MonitorSmartphone,
  Shield,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button, CountryFlag, RichText, Skeleton, TrafficSourceList, toast } from '@fatexia/ui';
import type { AffiliateOffer } from '@fatexia/types';
import { getAvailableOffer, setOfferFavourite } from '../../lib/offers-api';
import { useAsync } from '../../hooks/useAsync';
import { date, money, percent } from '../../lib/format';
import { payoutAmountLabel, payoutLabels, payoutModes, targetingUnion } from '../../lib/offer-display';
import { SubIdBuilder } from './SubIdBuilder';

/**
 * A panel. `accent` tints the header strip so the eye can find a section by colour on
 * the way back to it — the page is long, and an affiliate returning to copy a link or
 * re-check a traffic rule is looking for one specific block, not reading it through.
 */
const ACCENTS = {
  primary: 'text-primary bg-primary/10',
  emerald: 'text-emerald-500 bg-emerald-500/10',
  sky: 'text-sky-500 bg-sky-500/10',
  violet: 'text-violet-500 bg-violet-500/10',
  amber: 'text-amber-500 bg-amber-500/10',
  rose: 'text-rose-500 bg-rose-500/10',
} as const;

function Panel({
  title,
  icon,
  accent = 'primary',
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  accent?: keyof typeof ACCENTS;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-card ${className ?? ''}`}>
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className={`flex size-7 items-center justify-center rounded-lg ${ACCENTS[accent]}`}>{icon}</span>
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-card-foreground">{children}</div>
    </div>
  );
}

/**
 * One headline figure.
 *
 * Not the shared StatCard: these carry no delta, no sparkline and no comparison window,
 * and a tile shaped for a dashboard would leave three empty affordances on each one.
 */
function Metric({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: keyof typeof ACCENTS;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className={`flex size-7 items-center justify-center rounded-lg ${ACCENTS[accent]}`}>{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-card-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function TargetingValue({ values, flags = false }: { values: string[]; flags?: boolean }) {
  // Empty means unrestricted, not unknown — see targetingUnion.
  if (values.length === 0) {
    return (
      <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
        All
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs capitalize text-secondary-foreground"
        >
          {flags && <CountryFlag code={value} title={value} />}
          {value}
        </span>
      ))}
    </div>
  );
}

/**
 * One offer, in full — the page an affiliate reads before running it.
 *
 * Everything the browse row deliberately leaves out lives here: the tracking link, the
 * traffic-source rules, the brief and the caps. The split is by what each is for — a
 * row is scanned to choose an offer, this page is read once one is chosen — and it also
 * means the catalogue screen never renders a link for the offers on it that nobody has
 * been approved for.
 *
 * Ordered by what the visit is for rather than by what the API returns. The link comes
 * first in the main column, because copying it is why most visits happen; the numbers
 * that decide whether to run the offer sit above it; and the reference material — geo,
 * tiers, caps, dates — goes in the side column where it can be checked without pushing
 * the link below the fold.
 *
 * Its own URL rather than a modal so it survives a refresh and can be sent to a manager.
 */
export function OfferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const offer = useAsync<AffiliateOffer>(() => getAvailableOffer(id!), [id]);

  const [favourite, setFavourite] = useState<boolean | null>(null);

  const data = offer.data;
  const isFavourite = favourite ?? data?.favourite ?? false;

  async function toggleFavourite() {
    if (!data) return;
    const next = !isFavourite;
    setFavourite(next);
    try {
      await setOfferFavourite(data.id, next);
    } catch (err) {
      setFavourite(!next);
      toast.error(err instanceof Error ? err.message : 'Could not save the bookmark');
    }
  }

  if (offer.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  // Covers the gated case too: the server refuses this page for an offer the affiliate
  // has no access to, and its message says to ask from Browse (see getAvailableOffer).
  if (offer.error || !data) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <Shield className="size-6" />
        </span>
        <p className="mt-4 text-sm text-card-foreground">{offer.error ?? 'This offer is not available.'}</p>
        <Button className="mt-5" onClick={() => navigate('/offers/browse')}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back to Browse offers
        </Button>
      </div>
    );
  }

  const payouts = payoutLabels(data);
  const models = payoutModes(data);
  const hold = data.payoutRules.find((rule) => rule.holdSchedule.enabled)?.holdSchedule ?? null;

  return (
    <div className="space-y-6">
      {/* Hero. The creative is the background when the offer has one, behind a gradient
          heavy enough that the name stays readable over any artwork — an advertiser's
          banner is not designed to have text laid on it. */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-card">
        {data.iconUrl && <img src={data.iconUrl} alt="" className="absolute inset-0 size-full object-cover" />}
        <div
          className={`relative flex flex-wrap items-start justify-between gap-4 p-5 ${
            data.iconUrl ? 'bg-gradient-to-r from-card via-card/95 to-card/70' : 'bg-gradient-to-r from-primary/10 to-transparent'
          }`}
        >
          <div className="flex min-w-0 items-start gap-4">
            {data.iconUrl ? (
              <img src={data.iconUrl} alt="" className="size-16 shrink-0 rounded-xl border border-border object-cover shadow-sm" />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xl font-semibold text-primary">
                {data.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">{data.name}</h1>
                {data.featured && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
                    Featured
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {/* The offer number leads: it is what the affiliate quotes back to a
                    manager and what the tracking link below carries. */}
                <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-secondary-foreground">#{data.refId}</span>
                {data.category && (
                  <span className="rounded-md bg-violet-500/10 px-2 py-0.5 font-medium text-violet-500">{data.category}</span>
                )}
                {models.length > 0 && (
                  <span className="rounded-md bg-sky-500/10 px-2 py-0.5 font-medium text-sky-500">{models.join(' · ')}</span>
                )}
                {data.networkOfferId && <span className="text-muted-foreground">advertiser ref {data.networkOfferId}</span>}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant={isFavourite ? 'primary' : 'outline'} onClick={toggleFavourite}>
              <Bookmark className={`mr-1.5 size-4 ${isFavourite ? 'fill-current' : ''}`} />
              {isFavourite ? 'Bookmarked' : 'Bookmark'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/offers/browse')}>
              <ArrowLeft className="mr-1.5 size-4" />
              Back
            </Button>
          </div>
        </div>
      </header>

      {/* The four numbers that decide whether to run it, before anything that explains
          how. Payout and EPC share the money colour on purpose — both are what the
          affiliate earns, from different angles. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Payout"
          value={payouts.length > 0 ? payouts.join(' / ') : '—'}
          sub={models.length > 0 ? `per ${models.join(' / ')}` : undefined}
          icon={<Wallet className="size-4" />}
          accent="emerald"
        />
        <Metric
          label="Network CR"
          value={data.conversionRate === null ? '—' : percent(data.conversionRate)}
          sub={data.conversionRate === null ? 'No traffic in the last 30 days' : 'All affiliates, last 30 days'}
          icon={<TrendingUp className="size-4" />}
          accent="sky"
        />
        <Metric
          label="Network EPC"
          value={data.epc === null ? '—' : money(data.epc, data.currency)}
          sub={data.epc === null ? 'No traffic in the last 30 days' : 'Payout per click, last 30 days'}
          icon={<Gauge className="size-4" />}
          accent="violet"
        />
        <Metric
          label="Hold"
          value={hold ? `${hold.days} days` : 'None'}
          sub={hold ? 'After the conversion is approved' : 'Payable as soon as approved'}
          icon={<CalendarClock className="size-4" />}
          accent="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* First in the column: copying this is why most visits to this page happen. */}
          {data.trackingLink && (
            <Panel title="Your tracking link" icon={<Link2 className="size-4" />} accent="primary">
              <SubIdBuilder baseLink={data.trackingLink} />
              {data.previewLink && (
                <a
                  href={data.previewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-9 items-center rounded-md border border-border px-4 text-sm text-card-foreground hover:bg-accent"
                >
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Preview landing page
                </a>
              )}
            </Panel>
          )}

          {/* Its own panel in the main column, not a line in a grid: sending a forbidden
              source is how an affiliate gets a batch of conversions voided, so it has to
              be readable before they copy the link rather than after. */}
          <Panel title="Traffic sources" icon={<Shield className="size-4" />} accent="rose">
            <TrafficSourceList
              allowed={data.trafficTypes}
              disallowed={data.disallowedTrafficTypes}
              emptyMessage="No traffic restrictions stated — check with your manager before running anything unusual."
            />
          </Panel>

          {(data.kpi || data.description || data.remarksForAffiliateManager) && (
            <Panel title="Brief" icon={<Target className="size-4" />} accent="violet">
              <div className="space-y-4">
                {data.kpi && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-500">What counts as a conversion</p>
                    <p className="mt-1 text-sm text-card-foreground">{data.kpi}</p>
                  </div>
                )}
                {data.description && (
                  <Field label="Description">
                    <RichText html={data.description} className="text-muted-foreground" />
                  </Field>
                )}
                {data.remarksForAffiliateManager && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-500">Notes from your manager</p>
                    <p className="mt-1 text-sm text-card-foreground">{data.remarksForAffiliateManager}</p>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Targeting" icon={<Globe2 className="size-4" />} accent="sky">
            <div className="space-y-4">
              <Field label="Countries">
                <TargetingValue values={targetingUnion(data, 'countries')} flags />
              </Field>
              <Field label="Devices">
                <TargetingValue values={targetingUnion(data, 'devices')} />
              </Field>
              <Field label="Operating systems">
                <TargetingValue values={targetingUnion(data, 'os')} />
              </Field>
            </div>
          </Panel>

          <Panel title="Payout tiers" icon={<Wallet className="size-4" />} accent="emerald">
            {data.payoutRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payout rule set yet — ask your manager before running traffic.</p>
            ) : (
              <div className="space-y-2">
                {data.payoutRules.map((rule) => (
                  <div key={rule.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-semibold text-emerald-500">{payoutAmountLabel(rule, data.currency)}</span>
                      <span className="text-xs text-muted-foreground">per {rule.payoutMode}</span>
                    </div>
                    {/* Which market this particular tier prices for — an offer with
                        several rules pays differently by geo, and the row it applies to
                        is the only way to tell which number is yours. */}
                    {(rule.countries.length > 0 || rule.devices.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {rule.countries.map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground"
                          >
                            <CountryFlag code={code} title={code} />
                            {code}
                          </span>
                        ))}
                        {rule.devices.length > 0 && (
                          <span className="text-[11px] capitalize text-muted-foreground">{rule.devices.join(', ')}</span>
                        )}
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {rule.holdSchedule.enabled ? `Held ${rule.holdSchedule.days} days after approval` : 'No hold'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {data.caps.length > 0 && (
            <Panel title="Caps" icon={<Gauge className="size-4" />} accent="amber">
              <ul className="space-y-2">
                {data.caps.map((cap) => (
                  <li key={cap.id} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm">
                    <span className="capitalize text-muted-foreground">
                      {cap.period.toLowerCase()} {cap.metric.toLowerCase()}
                    </span>
                    <span className="font-medium text-card-foreground">{cap.limit.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Details" icon={<MonitorSmartphone className="size-4" />} accent="primary">
            <dl className="space-y-3">
              {[
                ['Currency', data.currency],
                ['Deep linking', data.allowDeepLinking ? 'Allowed' : 'Not allowed'],
                ['Runs from', date(data.startDate ?? null)],
                ['Runs until', data.endDate ? date(data.endDate) : 'No end date'],
                ['Added', date(data.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium text-card-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
