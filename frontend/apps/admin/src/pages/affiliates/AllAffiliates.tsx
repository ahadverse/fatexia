import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfirmModal,
  DataTable,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  Select,
  TableSkeleton,
  type DataTableColumn,
} from '@fatexia/ui';
import { describePayout, readCryptoDetails } from '@fatexia/types';
import type { Affiliate, UserStatus } from '@fatexia/types';
import { getAffiliates, impersonateAffiliate, markAffiliateEmailVerified, updateAffiliateStatus } from '../../lib/affiliates-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { date, dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const STATUS_OPTIONS: UserStatus[] = ['ACTIVE', 'PENDING', 'BLOCKED', 'REJECTED', 'INACTIVE'];

interface StatusDecision {
  affiliate: Affiliate;
  next: 'REJECTED' | 'BLOCKED';
}

const DECISION_COPY: Record<StatusDecision['next'], { title: string; verb: string }> = {
  REJECTED: { title: 'Reject this application?', verb: 'rejected' },
  BLOCKED: { title: 'Suspend this affiliate?', verb: 'suspended' },
};

// Environment-aware fallback: Vite bakes `VITE_*` in at build time, so an unset
// variable cannot be corrected at runtime. Defaulting to localhost in a production
// build sends the operator to their own machine — the same way it once sent public
// "Sign in" traffic there. Setting VITE_AFFILIATE_URL is still correct; this only
// makes forgetting it degrade to the real domain.
const AFFILIATE_PORTAL_URL =
  (import.meta.env.VITE_AFFILIATE_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://affiliates.fatexia.com' : 'http://localhost:5174');

export interface AllAffiliatesProps {
  /** Pre-filters the list. Affiliates → Pending is this page pinned to PENDING. */
  defaultStatus?: UserStatus | '';
  title?: string;
  description?: string;
}

export function AllAffiliates({
  defaultStatus = '',
  title = 'All affiliates',
  description = 'Everyone with an affiliate account and their current standing.',
}: AllAffiliatesProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<UserStatus | ''>(defaultStatus);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Affiliate | null>(null);
  const [approving, setApproving] = useState<Affiliate | null>(null);
  const [alsoVerify, setAlsoVerify] = useState(true);
  const [approveSaving, setApproveSaving] = useState(false);
  const [decision, setDecision] = useState<StatusDecision | null>(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [impersonating, setImpersonating] = useState<Affiliate | null>(null);
  const [impersonateSaving, setImpersonateSaving] = useState(false);

  const affiliates = useAsync(
    () => getAffiliates({ status: status || undefined, search: search || undefined }),
    [status, search],
  );

  function openApprove(affiliate: Affiliate) {
    setApproving(affiliate);
    setAlsoVerify(true);
  }

  async function confirmApprove() {
    if (!approving) return;
    setApproveSaving(true);
    const result = await runAction(
      async () => {
        if (alsoVerify && !approving.emailVerified) {
          await markAffiliateEmailVerified(approving.id);
        }
        return updateAffiliateStatus(approving.id, 'ACTIVE');
      },
      { success: `${approving.fullName ?? approving.email} is now active`, onDone: affiliates.reload },
    );
    setApproveSaving(false);
    if (result) setApproving(null);
  }

  async function confirmDecision() {
    if (!decision) return;
    setDecisionSaving(true);
    const result = await runAction(() => updateAffiliateStatus(decision.affiliate.id, decision.next), {
      success: `${decision.affiliate.fullName ?? decision.affiliate.email} is now ${DECISION_COPY[decision.next].verb}`,
      onDone: affiliates.reload,
    });
    setDecisionSaving(false);
    if (result) setDecision(null);
  }

  async function confirmImpersonate() {
    if (!impersonating) return;
    setImpersonateSaving(true);
    const tokens = await runAction(() => impersonateAffiliate(impersonating.id), {
      success: `Opening ${impersonating.fullName ?? impersonating.email}'s portal…`,
    });
    setImpersonateSaving(false);
    if (tokens) {
      // A new tab, not a redirect of this one — the admin's own session stays put.
      window.open(`${AFFILIATE_PORTAL_URL}/?at=${tokens.accessToken}&rt=${tokens.refreshToken}`, '_blank', 'noopener');
      setImpersonating(null);
    }
  }

  async function markVerifiedFromDetail(affiliate: Affiliate) {
    const result = await runAction(() => markAffiliateEmailVerified(affiliate.id), {
      success: `${affiliate.fullName ?? affiliate.email} marked as email-verified`,
      onDone: affiliates.reload,
    });
    if (result) setDetail(result);
  }

  const columns: DataTableColumn<Affiliate>[] = [
    {
      key: 'name',
      header: 'Affiliate',
      render: (row) => (
        <button type="button" onClick={() => setDetail(row)} className="text-left">
          <p className="text-card-foreground hover:underline">{row.fullName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </button>
      ),
    },
    { key: 'company', header: 'Company', render: (row) => row.companyName ?? '—' },
    { key: 'country', header: 'Country', render: (row) => row.country ?? '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    {
      key: 'emailVerified',
      header: 'Email',
      render: (row) =>
        row.emailVerified ? (
          <span className="text-xs font-medium text-success">Verified</span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">Not verified</span>
        ),
    },
    { key: 'joined', header: 'Joined', render: (row) => date(row.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-2">
          {row.status !== 'ACTIVE' && (
            <Button size="sm" variant="outline" onClick={() => openApprove(row)}>
              Approve
            </Button>
          )}
          {row.status === 'PENDING' && (
            <Button size="sm" variant="destructive" onClick={() => setDecision({ affiliate: row, next: 'REJECTED' })}>
              Reject
            </Button>
          )}
          {row.status === 'ACTIVE' && (
            <Button size="sm" variant="destructive" onClick={() => setDecision({ affiliate: row, next: 'BLOCKED' })}>
              Suspend
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={<Button onClick={() => navigate('/affiliates/create')}>Create affiliate</Button>}
      />

      <FilterBar>
        <FilterField label="Search">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or company"
            className="w-56"
          />
        </FilterField>
        <FilterField label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as UserStatus | '')} className="w-40">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {affiliates.error && <p className="text-sm text-destructive">{affiliates.error}</p>}

      {affiliates.loading ? (
        <TableSkeleton columns={6} />
      ) : (
        <DataTable
          columns={columns}
          rows={affiliates.data ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="No affiliates match these filters."
        />
      )}

      <Modal
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.fullName ?? 'Affiliate'}
        className="max-w-2xl"
      >
        {detail && (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Button size="sm" variant="outline" onClick={() => setImpersonating(detail)}>
                Log in as this affiliate
              </Button>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Email verified</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-card-foreground">
                {detail.emailVerified ? (
                  'Yes'
                ) : (
                  <>
                    No
                    <button
                      type="button"
                      onClick={() => markVerifiedFromDetail(detail)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Mark verified
                    </button>
                  </>
                )}
              </dd>
            </div>
            {[
              ['Email', detail.email],
              ['Status', detail.status],
              ['Company', detail.companyName ?? '—'],
              ['Country', detail.country ?? '—'],
              ['Phone', detail.phone ?? '—'],
              ['Messenger', detail.messengerHandle ? `${detail.messengerType} · ${detail.messengerHandle}` : '—'],
              ['Website', detail.websiteUrl ?? '—'],
              ['Traffic sources', detail.trafficSources.join(', ') || '—'],
              ['Verticals', detail.verticals.join(', ') || '—'],
              ['Monthly volume', detail.monthlyVolume ?? '—'],
              ['Heard about us via', detail.referralSource ?? '—'],
              ['Referral code', detail.referralCode ?? '—'],
              ['Payout method', describePayout(detail.payoutMethod, detail.payoutDetails)],
              ['Last login', dateTime(detail.lastLogin)],
              ['Joined', dateTime(detail.createdAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 break-words text-card-foreground">{value}</dd>
              </div>
            ))}
            {detail.payoutMethod === 'CRYPTO' && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Wallet address</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-card-foreground">
                  {readCryptoDetails(detail.payoutDetails).walletAddress || 'Not provided'}
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Postback URL</dt>
              <dd className="mt-0.5 break-all text-xs text-card-foreground">{detail.postbackUrl ?? 'Not configured'}</dd>
            </div>
            {detail.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Notes</dt>
                <dd className="mt-0.5 text-card-foreground">{detail.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>

      <Modal open={!!approving} onOpenChange={(open) => !open && setApproving(null)} title="Approve this affiliate?">
        {approving && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="text-card-foreground">{approving.fullName ?? approving.email}</span> will be able to log
              in and start running offers immediately.
            </p>
            {!approving.emailVerified && (
              <label className="flex items-start gap-2.5 rounded-md border border-border bg-accent/40 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={alsoVerify}
                  onChange={(event) => setAlsoVerify(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-card-foreground">Also mark their email as verified.</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    They haven&apos;t completed email verification yet.
                  </span>
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApproving(null)}>
                Cancel
              </Button>
              <Button disabled={approveSaving} onClick={confirmApprove}>
                {approveSaving ? 'Approving…' : 'Approve'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!decision}
        onOpenChange={(open) => !open && setDecision(null)}
        title={decision ? DECISION_COPY[decision.next].title : ''}
        description={
          decision
            ? `${decision.affiliate.fullName ?? decision.affiliate.email} will be ${DECISION_COPY[decision.next].verb}${decision.next === 'BLOCKED' ? ' and immediately lose access' : ''}.`
            : ''
        }
        confirmLabel={decision?.next === 'REJECTED' ? 'Reject' : 'Suspend'}
        destructive
        loading={decisionSaving}
        onConfirm={confirmDecision}
      />

      <ConfirmModal
        open={!!impersonating}
        onOpenChange={(open) => !open && setImpersonating(null)}
        title="Log in as this affiliate?"
        description={
          impersonating
            ? `Opens a new tab, fully authenticated as ${impersonating.fullName ?? impersonating.email} in their affiliate portal. This is recorded in their login history.`
            : ''
        }
        confirmLabel="Log in as affiliate"
        loading={impersonateSaving}
        onConfirm={confirmImpersonate}
      />
    </div>
  );
}

export function PendingAffiliates() {
  return (
    <AllAffiliates
      defaultStatus="PENDING"
      title="Pending affiliates"
      description="Applications waiting on a decision. Approving provisions their login immediately."
    />
  );
}
