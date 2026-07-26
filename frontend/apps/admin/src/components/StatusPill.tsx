import { StatusBadge, type StatusBadgeVariant } from '@fatexia/ui';

// One mapping from every status enum in the system to a semantic badge variant.
// Kept in one place so PENDING never reads as a warning on one screen and neutral on
// another, and so a new status can't silently fall through to an unstyled pill.
const VARIANTS: Record<string, StatusBadgeVariant> = {
  // Shared lifecycle
  ACTIVE: 'success',
  APPROVED: 'success',
  PUBLISHED: 'success',
  PAID: 'success',
  GOOD: 'success',
  SUCCESS: 'success',

  PENDING: 'warning',
  PAUSED: 'warning',
  SUSPECT: 'warning',
  PAST_DUE: 'warning',
  TRIAL: 'warning',
  DRAFT: 'warning',
  WARNING: 'warning',
  DROPPED: 'warning',

  REJECTED: 'destructive',
  BLOCKED: 'destructive',
  DELETED: 'destructive',
  SUSPENDED: 'destructive',
  CANCELLED: 'destructive',
  CHARGEBACK: 'destructive',
  ERROR: 'destructive',

  INFO: 'info',
  INBOUND: 'info',
  OUTBOUND: 'info',
  SPIKED: 'info',

  UNSCORED: 'neutral',
  INACTIVE: 'neutral',
  DUPLICATE: 'neutral',
  ARCHIVED: 'neutral',
  NOT_CONFIGURED: 'neutral',
  DISABLED: 'neutral',
  STABLE: 'neutral',
};

export interface StatusPillProps {
  status: string;
  /** Overrides the label while keeping the status-derived color. */
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  return <StatusBadge variant={VARIANTS[status] ?? 'neutral'}>{label ?? status.replace(/_/g, ' ')}</StatusBadge>;
}
