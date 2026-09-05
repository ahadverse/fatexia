import { Button, DataTable, EmptyState, PageHeader, StatCard, TableSkeleton, toast, type DataTableColumn } from '@fatexia/ui';
import type { Affiliate, OwnReferral } from '@fatexia/types';
import { getOwnProfile, getOwnReferrals } from '../../lib/portal-api';
import { useAsync } from '../../hooks/useAsync';
import { date, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

// Built from the portal's own origin rather than a VITE_ variable: this page only ever
// renders inside the affiliate portal, so where it is running IS the address to share,
// and there is no build-time setting to forget.
function inviteLink(referralCode: string): string {
  return `${window.location.origin}/register?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * The affiliate's own referral code and who they brought in.
 *
 * Deliberately shows no earnings for referred affiliates — another affiliate's
 * performance is not this affiliate's data, regardless of who referred whom. The
 * referral commission itself arrives as part of their own payout.
 */
export function ReferralProgram() {
  const profile = useAsync<Affiliate>(() => getOwnProfile(), []);
  const referrals = useAsync<OwnReferral[]>(() => getOwnReferrals(), []);

  const rows = referrals.data ?? [];
  const active = rows.filter((row) => row.status === 'ACTIVE').length;

  const columns: DataTableColumn<OwnReferral>[] = [
    { key: 'name', header: 'Affiliate', render: (row) => row.fullName ?? '—' },
    { key: 'country', header: 'Country', render: (row) => row.country ?? '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'joined', header: 'Joined', render: (row) => date(row.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral program"
        description="Invite other affiliates with your code. When they earn, you receive a referral commission on top of your own payouts."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-1">
          <h2 className="text-sm font-medium text-muted-foreground">Your referral code</h2>
          {profile.loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : profile.data?.referralCode ? (
            <>
              <p className="mt-3 font-mono text-2xl font-semibold tracking-wider text-card-foreground">
                {profile.data.referralCode}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(profile.data!.referralCode!);
                    toast.success('Referral code copied');
                  }}
                >
                  Copy code
                </Button>
                {/* The link is the useful thing to share: `?ref=` prefills the code on
                    the register form, so an invitee never has to type it correctly. */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(inviteLink(profile.data!.referralCode!));
                    toast.success('Invite link copied');
                  }}
                >
                  Copy invite link
                </Button>
              </div>
              <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                {inviteLink(profile.data.referralCode)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No referral code has been issued for your account yet — ask your manager.
            </p>
          )}
        </div>

        <StatCard tone="info" label="Affiliates referred" value={number(rows.length)} />
        <StatCard tone="info" label="Currently active" value={number(active)} />
      </div>

      {referrals.error && <p className="text-sm text-destructive">{referrals.error}</p>}

      {referrals.loading ? (
        <TableSkeleton columns={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nobody signed up with your code yet"
          description="Share your code with affiliates you know. Anyone who registers with it shows up here."
        />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />
      )}
    </div>
  );
}
