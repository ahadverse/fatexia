import { useState } from 'react';
import {
  Button,
  DataTable,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  TableSkeleton,
  Textarea,
  type DataTableColumn,
} from '@fatexia/ui';
import type { Advertiser, BillingCycle, Subscription, SubscriptionPlan, SubscriptionStatus } from '@fatexia/types';
import { createSubscription, getSubscriptions, updateSubscription } from '../../lib/platform-api';
import { getAdvertisers } from '../../lib/advertisers-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { compactMoney, date, isoDate, money, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

interface FormState {
  id: string | null;
  advertiserId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: string;
  startedAt: string;
  renewsAt: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  advertiserId: '',
  plan: 'STARTER',
  status: 'TRIAL',
  billingCycle: 'MONTHLY',
  amount: '0',
  startedAt: isoDate(new Date()),
  renewsAt: '',
  notes: '',
};

// Advertiser-side plans. The advertiser self-service portal is deferred (PLAN-admin.md),
// so admin manages these records directly for now.
export function Subscriptions() {
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const subscriptions = useAsync(() => getSubscriptions({ status: status || undefined }), [status]);
  const advertisers = useAsync<Advertiser[]>(() => getAdvertisers(), []);

  const rows = subscriptions.data ?? [];
  // Annual and quarterly plans are normalised to a monthly figure so the total is a
  // comparable run-rate rather than a sum of different billing periods.
  const monthlyRunRate = rows
    .filter((row) => row.status === 'ACTIVE')
    .reduce((sum, row) => sum + row.amount / (row.billingCycle === 'ANNUAL' ? 12 : row.billingCycle === 'QUARTERLY' ? 3 : 1), 0);

  async function save() {
    if (!form) return;
    const payload = {
      advertiserId: form.advertiserId,
      plan: form.plan,
      status: form.status,
      billingCycle: form.billingCycle,
      amount: Number(form.amount) || 0,
      currency: 'USD',
      startedAt: new Date(form.startedAt).toISOString(),
      renewsAt: form.renewsAt ? new Date(form.renewsAt).toISOString() : null,
      notes: form.notes || undefined,
    };
    setSaving(true);
    const result = await runAction(
      () => (form.id ? updateSubscription(form.id, payload) : createSubscription(payload)),
      { success: form.id ? 'Subscription updated' : 'Subscription created', onDone: subscriptions.reload },
    );
    setSaving(false);
    if (result) setForm(null);
  }

  const columns: DataTableColumn<Subscription>[] = [
    { key: 'advertiser', header: 'Advertiser', render: (row) => row.advertiserName ?? row.advertiserId },
    { key: 'plan', header: 'Plan', render: (row) => row.plan.toLowerCase() },
    { key: 'cycle', header: 'Billing', render: (row) => row.billingCycle.toLowerCase() },
    { key: 'amount', header: 'Amount', render: (row) => money(row.amount, row.currency) },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'startedAt', header: 'Started', render: (row) => date(row.startedAt) },
    { key: 'renewsAt', header: 'Renews', render: (row) => date(row.renewsAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setForm({
              id: row.id,
              advertiserId: row.advertiserId,
              plan: row.plan,
              status: row.status,
              billingCycle: row.billingCycle,
              amount: String(row.amount),
              startedAt: row.startedAt.slice(0, 10),
              renewsAt: row.renewsAt?.slice(0, 10) ?? '',
              notes: row.notes ?? '',
            })
          }
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Advertiser plan records. The advertiser self-service portal is a later phase, so these are managed here for now."
        actions={<Button onClick={() => setForm({ ...EMPTY_FORM })}>New subscription</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Subscriptions" value={number(rows.length)} />
        <StatCard label="Active" value={number(rows.filter((row) => row.status === 'ACTIVE').length)} />
        <StatCard label="Past due" value={number(rows.filter((row) => row.status === 'PAST_DUE').length)} />
        <StatCard label="Monthly run-rate" value={compactMoney(monthlyRunRate)} />
      </div>

      <FilterBar>
        <FilterField label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as SubscriptionStatus | '')} className="w-44">
            <option value="">All statuses</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="PAST_DUE">Past due</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </FilterField>
      </FilterBar>

      {subscriptions.error && <p className="text-sm text-destructive">{subscriptions.error}</p>}

      {subscriptions.loading ? (
        <TableSkeleton columns={8} />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} emptyMessage="No subscriptions match this filter." />
      )}

      <Modal
        open={!!form}
        onOpenChange={(open) => !open && setForm(null)}
        title={form?.id ? 'Edit subscription' : 'New subscription'}
      >
        {form && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Advertiser</span>
              <Select
                value={form.advertiserId}
                disabled={!!form.id}
                onChange={(event) => setForm({ ...form, advertiserId: event.target.value })}
                className="mt-1"
              >
                <option value="">Select an advertiser</option>
                {(advertisers.data ?? []).map((advertiser) => (
                  <option key={advertiser.id} value={advertiser.id}>
                    {advertiser.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Plan</span>
                <Select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value as SubscriptionPlan })} className="mt-1">
                  <option value="STARTER">Starter</option>
                  <option value="GROWTH">Growth</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as SubscriptionStatus })} className="mt-1">
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAST_DUE">Past due</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Billing cycle</span>
                <Select value={form.billingCycle} onChange={(event) => setForm({ ...form, billingCycle: event.target.value as BillingCycle })} className="mt-1">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Amount (USD)</span>
                <Input type="number" step="0.01" min={0} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Started</span>
                <Input type="date" value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Renews</span>
                <Input type="date" value={form.renewsAt} onChange={(event) => setForm({ ...form, renewsAt: event.target.value })} className="mt-1" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1" />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={save}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create subscription'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
