import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy } from 'lucide-react';
import type { Advertiser, Offer, OfferStatus } from '@fatexia/types';
import { ExternalLinkButton, StatusBadge, toast } from '@fatexia/ui';
import { getAdvertisers } from '../../lib/advertisers-api';
import { getOffer } from '../../lib/offers-api';

const STATUS_VARIANT: Record<OfferStatus, 'success' | 'destructive' | 'warning' | 'neutral'> = {
  APPROVED: 'success',
  REJECTED: 'destructive',
  PAUSED: 'warning',
  PENDING: 'neutral',
  DELETED: 'destructive',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? '—'}</span>
    </div>
  );
}

// For long copyable values (URLs) — truncates with an ellipsis instead of wrapping
// or overflowing the card, and a click copies the untruncated value.
function CopyableRow({ label, value }: { label: string; value: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="min-w-0 truncate font-medium text-foreground" title={value}>
          {value}
        </span>
        <ExternalLinkButton href={value} label={`Open ${label} in new tab`} className="h-7 shrink-0 px-1.5" />
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={`Copy ${label}`}
        >
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function OfferDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getOffer(id), getAdvertisers()])
      .then(([o, a]) => {
        setOffer(o);
        setAdvertisers(a);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load offer'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!offer || !id) return <p className="text-sm text-muted-foreground">Offer not found.</p>;

  const advertiserName = advertisers.find((a) => a.id === offer.advertiserId)?.name ?? offer.advertiserId;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{offer.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge variant={STATUS_VARIANT[offer.status]}>{offer.status}</StatusBadge>
            <span className="text-sm text-muted-foreground">{advertiserName}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/offers/all')} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Back
          </button>
          <button type="button" onClick={() => navigate(`/offers/${id}/edit`)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Edit Offer
          </button>
        </div>
      </div>

      <Section title="Basic Details">
        <Row label="Advertiser" value={advertiserName} />
        <Row label="Category" value={offer.category} />
        <Row label="Tracking Platform" value={offer.trackingPlatform} />
        <Row label="Currency" value={offer.currency} />
        <Row label="Default Payout" value={`${offer.currency} ${offer.defaultPayoutAmount.toFixed(2)}`} />
        <Row label="Start Date" value={offer.startDate ? new Date(offer.startDate).toLocaleDateString() : undefined} />
        <Row label="End Date" value={offer.endDate ? new Date(offer.endDate).toLocaleDateString() : undefined} />
        <Row label="Traffic Allowed" value={offer.trafficTypes.length ? offer.trafficTypes.join(', ') : undefined} />
        <Row label="Featured" value={offer.featured ? 'Yes' : 'No'} />
        <Row label="Network Offer ID" value={offer.networkOfferId} />
        <Row label="Created" value={new Date(offer.createdAt).toLocaleString()} />
      </Section>

      {(offer.description || offer.kpi) && (
        <Section title="Description & KPI">
          {offer.description && (
            <div className="space-y-1 py-2 text-sm">
              <p className="text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap text-foreground">{offer.description}</p>
            </div>
          )}
          {offer.kpi && (
            <div className="space-y-1 py-2 text-sm">
              <p className="text-muted-foreground">Offer KPI</p>
              <p className="whitespace-pre-wrap text-foreground">{offer.kpi}</p>
            </div>
          )}
        </Section>
      )}

      <Section title="Destination & Postback">
        <Row label="Destination URL" value={offer.destinationUrl} />
        <Row label="Postback Secret" value={offer.postbackSecret ? '••••••••' : undefined} />
        <Row label="Allowed Postback IPs" value={offer.allowedPostbackIps} />
        <Row label="Blocked Traffic Redirect" value={offer.blockedRedirectUrl ?? 'Network default'} />
        <CopyableRow label="Tracking Link" value={offer.trackingLink} />
        {offer.postbackUrl ? (
          <CopyableRow label="Postback URL" value={offer.postbackUrl} />
        ) : (
          <Row label="Postback URL" value="Set a Postback Secret to generate this" />
        )}
        <Row label="Postback Verified" value={offer.postbackVerifiedAt ? new Date(offer.postbackVerifiedAt).toLocaleString() : 'Not yet verified'} />
      </Section>

      <Section title="Payout Rules">
        {offer.payoutRules.length === 0 && <p className="py-2 text-sm text-muted-foreground">No payout rules configured.</p>}
        <div className="space-y-3">
          {offer.payoutRules.map((rule) => (
            <div key={rule.id} className="rounded-md border border-border p-3 text-sm">
              <p>
                Payout Mode: <span className="font-medium text-foreground">{rule.payoutMode}</span> · Payout Type: {rule.payoutType} · Payout: ${rule.amount.toFixed(2)}
              </p>
              <p>
                Revenue Model: <span className="font-medium text-foreground">{rule.revenueModel}</span> · Revenue: ${rule.revenueAmount.toFixed(2)}
              </p>
              <p className="text-muted-foreground">
                Manager Commission: {rule.managerCommissionPercent}% · Refer Affiliate Commission: {rule.referAffiliateCommissionPercent}% · Hold:{' '}
                {rule.holdSchedule.enabled ? `${rule.holdSchedule.days} days` : 'Disabled'}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Cap Limits">
        {offer.caps.length === 0 && <p className="py-2 text-sm text-muted-foreground">No caps configured.</p>}
        <div className="space-y-2">
          {offer.caps.map((cap) => (
            <Row key={cap.id} label={`${cap.period} · ${cap.metric}`} value={cap.limit} />
          ))}
        </div>
      </Section>

      <Section title="Advanced Options">
        <Row label="Auto-approve conversions" value={offer.autoApproveConversions ? 'Yes' : 'No'} />
        <Row label="Allow deep linking" value={offer.allowDeepLinking ? 'Yes' : 'No'} />
      </Section>

      {(offer.remarksForAdmin || offer.remarksForAffiliateManager) && (
        <Section title="Remarks">
          {offer.remarksForAdmin && (
            <div className="space-y-1 py-2 text-sm">
              <p className="text-muted-foreground">For Admin</p>
              <p className="whitespace-pre-wrap text-foreground">{offer.remarksForAdmin}</p>
            </div>
          )}
          {offer.remarksForAffiliateManager && (
            <div className="space-y-1 py-2 text-sm">
              <p className="text-muted-foreground">For Affiliate Manager</p>
              <p className="whitespace-pre-wrap text-foreground">{offer.remarksForAffiliateManager}</p>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
