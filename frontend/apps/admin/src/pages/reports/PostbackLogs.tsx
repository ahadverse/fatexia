import { useMemo, useState } from 'react';
import {
  DataTable,
  FilterBar,
  FilterField,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TableSkeleton,
  type DataTableColumn,
} from '@fatexia/ui';
import type { PostbackLog } from '@fatexia/types';
import { getPostbackLogs } from '../../lib/reports-api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';
import { DateRangeFilter, defaultRange, toApiRange, type DateRange } from '../../components/DateRangeFilter';

const PAGE_SIZE = 50;

// INBOUND = advertiser → Fatexia. OUTBOUND = Fatexia → the affiliate's postback URL.
export function PostbackLogs() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [direction, setDirection] = useState('');
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(1);
  const [inspecting, setInspecting] = useState<PostbackLog | null>(null);

  const apiRange = toApiRange(range);
  const filters = useMemo(
    () => ({
      ...apiRange,
      direction: direction || undefined,
      // Left undefined when unset: sending `success=` would be coerced to false and
      // silently hide every successful delivery.
      success: outcome === '' ? undefined : outcome === 'success',
      page,
      pageSize: PAGE_SIZE,
    }),
    [apiRange.dateFrom, apiRange.dateTo, direction, outcome, page],
  );

  const logs = useAsync(() => getPostbackLogs(filters), [filters]);

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  const columns: DataTableColumn<PostbackLog>[] = [
    { key: 'createdAt', header: 'Time', render: (row) => dateTime(row.createdAt) },
    { key: 'direction', header: 'Direction', render: (row) => <StatusPill status={row.direction} /> },
    { key: 'offer', header: 'Offer', render: (row) => row.offerName ?? '—' },
    { key: 'affiliate', header: 'Affiliate', render: (row) => row.affiliateName ?? '—' },
    { key: 'status', header: 'Result', render: (row) => <StatusPill status={row.success ? 'APPROVED' : 'REJECTED'} label={row.success ? 'Success' : 'Failed'} /> },
    { key: 'http', header: 'HTTP', render: (row) => (row.responseStatus === null ? '—' : String(row.responseStatus)) },
    { key: 'attempts', header: 'Attempts', render: (row) => String(row.attemptCount) },
    {
      key: 'error',
      header: 'Error',
      render: (row) => <span className="text-xs text-muted-foreground">{row.errorMessage ?? '—'}</span>,
    },
    {
      key: 'payload',
      header: '',
      render: (row) => (
        <button type="button" onClick={() => setInspecting(row)} className="text-xs text-primary hover:underline">
          View payload
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Postback logs"
        description="Every inbound conversion postback and every outbound delivery attempt to an affiliate, including the failures."
      />

      <FilterBar right={<DateRangeFilter value={range} onChange={(next) => changeFilter(() => setRange(next))} />}>
        <FilterField label="Direction">
          <Select value={direction} onChange={(event) => changeFilter(() => setDirection(event.target.value))} className="w-40">
            <option value="">Both</option>
            <option value="INBOUND">Inbound</option>
            <option value="OUTBOUND">Outbound</option>
          </Select>
        </FilterField>
        <FilterField label="Result">
          <Select value={outcome} onChange={(event) => changeFilter(() => setOutcome(event.target.value))} className="w-40">
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </Select>
        </FilterField>
      </FilterBar>

      {logs.error && <p className="text-sm text-destructive">{logs.error}</p>}

      {logs.loading ? (
        <TableSkeleton columns={9} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={logs.data?.rows ?? []}
            getRowKey={(row) => row.id}
            emptyMessage="No postbacks matched these filters."
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={logs.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <Modal open={!!inspecting} onOpenChange={(open) => !open && setInspecting(null)} title="Postback payload">
        {inspecting && (
          <div className="space-y-3 text-sm">
            {inspecting.url && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">URL</p>
                <p className="break-all text-card-foreground">{inspecting.url}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Payload</p>
              <pre className="mt-1 max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-xs">
                {JSON.stringify(inspecting.payload, null, 2)}
              </pre>
            </div>
            {inspecting.errorMessage && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Error</p>
                <p className="text-destructive">{inspecting.errorMessage}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
