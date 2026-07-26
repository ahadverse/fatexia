import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
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
import { getAffiliates, updateAffiliateStatus } from '../../lib/affiliates-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { date, dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const STATUS_OPTIONS: UserStatus[] = ['ACTIVE', 'PENDING', 'BLOCKED', 'REJECTED', 'INACTIVE'];

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

  const affiliates = useAsync(
    () => getAffiliates({ status: status || undefined, search: search || undefined }),
    [status, search],
  );

  async function setAffiliateStatus(affiliate: Affiliate, next: UserStatus) {
    await runAction(() => updateAffiliateStatus(affiliate.id, next), {
      success: `${affiliate.fullName ?? affiliate.email} is now ${next.toLowerCase()}`,
      onDone: affiliates.reload,
    });
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
    { key: 'joined', header: 'Joined', render: (row) => date(row.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.status !== 'ACTIVE' && (
            <Button size="sm" variant="outline" onClick={() => setAffiliateStatus(row, 'ACTIVE')}>
              Approve
            </Button>
          )}
          {row.status === 'PENDING' && (
            <Button size="sm" variant="destructive" onClick={() => setAffiliateStatus(row, 'REJECTED')}>
              Reject
            </Button>
          )}
          {row.status === 'ACTIVE' && (
            <Button size="sm" variant="destructive" onClick={() => setAffiliateStatus(row, 'BLOCKED')}>
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
