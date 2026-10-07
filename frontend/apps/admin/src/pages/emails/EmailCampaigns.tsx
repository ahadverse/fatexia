import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ConfirmModal, EmptyState, Modal, PageHeader, Pagination, Skeleton, StatusBadge, toast } from '@fatexia/ui';
import {
  cancelEmailCampaign,
  getCampaignRecipients,
  getEmailCampaign,
  getEmailCampaigns,
  retryEmailCampaign,
  type CampaignAudience,
  type CampaignRecipientStatus,
  type CampaignStatus,
  type EmailCampaign,
} from '../../lib/platform-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';

const AUDIENCE_LABELS: Record<CampaignAudience, string> = {
  ALL: 'Everyone',
  AFFILIATES: 'Affiliates',
  ADVERTISERS: 'Advertisers',
  MANAGERS: 'Managers',
};

const STATUS_VARIANT: Record<CampaignStatus, 'info' | 'success' | 'neutral'> = {
  SENDING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const RECIPIENT_VARIANT: Record<CampaignRecipientStatus, 'success' | 'destructive' | 'neutral' | 'warning'> = {
  SENT: 'success',
  FAILED: 'destructive',
  SKIPPED: 'neutral',
  PENDING: 'warning',
};

function ProgressBar({ campaign }: { campaign: EmailCampaign }) {
  const total = Math.max(campaign.totalRecipients, 1);
  const sent = (campaign.sentCount / total) * 100;
  const failed = (campaign.failedCount / total) * 100;
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="bg-success" style={{ width: `${sent}%` }} />
        <div className="bg-destructive" style={{ width: `${failed}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {campaign.sentCount.toLocaleString()} sent
        {campaign.failedCount > 0 && <span className="text-destructive"> · {campaign.failedCount.toLocaleString()} failed</span>}
        {campaign.pendingCount > 0 && campaign.status === 'SENDING' && ` · ${campaign.pendingCount.toLocaleString()} waiting`}
        {' of '}
        {campaign.totalRecipients.toLocaleString()}
      </p>
    </div>
  );
}

function CampaignDetail({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const [recipientStatus, setRecipientStatus] = useState<CampaignRecipientStatus | ''>('');
  const [page, setPage] = useState(1);
  const campaign = useAsync(() => getEmailCampaign(id), [id]);
  const recipients = useAsync(
    () => getCampaignRecipients(id, { status: recipientStatus || undefined, page, pageSize: 25 }),
    [id, recipientStatus, page],
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = campaign.data?.status;

  // Poll while it is sending so the admin watches the numbers move rather than
  // reloading; stops by itself once the campaign leaves SENDING.
  useEffect(() => {
    if (status !== 'SENDING') return;
    const timer = window.setInterval(() => {
      campaign.reload();
      recipients.reload();
      onChanged();
    }, 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    await runAction(action, {
      success,
      onDone: () => {
        campaign.reload();
        recipients.reload();
        onChanged();
      },
    });
    setBusy(false);
    setConfirmCancel(false);
  }

  const data = campaign.data;
  if (!data) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-card-foreground">{data.subject}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {AUDIENCE_LABELS[data.audience]}
          {data.activeOnly ? ' (active only)' : ''} · {dateTime(data.createdAt)}
          {data.createdByEmail && ` · by ${data.createdByEmail}`}
        </p>
      </div>

      <ProgressBar campaign={data} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={recipientStatus}
          onChange={(event) => {
            setRecipientStatus(event.target.value as CampaignRecipientStatus | '');
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All recipients</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="PENDING">Waiting</option>
          <option value="SKIPPED">Skipped</option>
        </select>
        <div className="flex gap-2">
          {data.status === 'SENDING' && (
            <Button variant="outline" disabled={busy} onClick={() => setConfirmCancel(true)}>
              Cancel sending
            </Button>
          )}
          {data.status === 'COMPLETED' && data.failedCount > 0 && (
            <Button disabled={busy} onClick={() => act(() => retryEmailCampaign(id), 'Retrying failed recipients')}>
              Retry {data.failedCount} failed
            </Button>
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Recipient</th>
              <th className="px-3 py-2 font-medium">Group</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(recipients.data?.rows ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <span className="text-card-foreground">{row.email}</span>
                  {row.fullName && <span className="block text-xs text-muted-foreground">{row.fullName}</span>}
                  {row.error && <span className="block text-xs text-destructive">{row.error}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{row.kind.toLowerCase()}</td>
                <td className="px-3 py-2">
                  <StatusBadge variant={RECIPIENT_VARIANT[row.status]}>{row.status.toLowerCase()}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {recipients.data && (
        <Pagination page={page} pageSize={25} total={recipients.data.total} onPageChange={setPage} />
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <ConfirmModal
        open={confirmCancel}
        onOpenChange={(open) => !open && setConfirmCancel(false)}
        title="Cancel this send?"
        description="Emails already delivered stay delivered. Everyone still waiting is skipped, and a cancelled campaign cannot be resumed."
        confirmLabel="Cancel sending"
        loading={busy}
        onConfirm={() => act(() => cancelEmailCampaign(id), 'Sending cancelled')}
      />
    </div>
  );
}

export function EmailCampaigns() {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const campaigns = useAsync(() => getEmailCampaigns({ page, pageSize: 20 }), [page]);

  useEffect(() => {
    if (campaigns.error) toast.error(campaigns.error);
  }, [campaigns.error]);

  const rows = campaigns.data?.rows ?? [];

  // Keep the list's own progress bars live while anything is still sending.
  const anySending = rows.some((row) => row.status === 'SENDING');
  useEffect(() => {
    if (!anySending) return;
    const timer = window.setInterval(() => campaigns.reload(), 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anySending]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Every email sent to an audience: who it went to, whether it arrived, and who it failed for."
        actions={
          <Link to="/emails/send">
            <Button>New email</Button>
          </Link>
        }
      />

      {campaigns.loading && !campaigns.data ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Emails you send to an audience will be listed here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Audience</th>
                <th className="w-64 px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setOpenId(row.id)}
                  className="cursor-pointer border-t border-border hover:bg-muted/40"
                >
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-card-foreground">{row.subject}</td>
                  <td className="px-4 py-3 text-muted-foreground">{AUDIENCE_LABELS[row.audience]}</td>
                  <td className="px-4 py-3">
                    <ProgressBar campaign={row} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={STATUS_VARIANT[row.status]}>{row.status.toLowerCase()}</StatusBadge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{dateTime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {campaigns.data && campaigns.data.total > 20 && (
        <Pagination page={page} pageSize={20} total={campaigns.data.total} onPageChange={setPage} />
      )}

      <Modal open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)} title="Campaign" className="max-w-3xl">
        {openId && <CampaignDetail id={openId} onChanged={campaigns.reload} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}
