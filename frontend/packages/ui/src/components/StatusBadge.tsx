import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type StatusBadgeVariant = 'neutral' | 'success' | 'warning' | 'destructive' | 'info';

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  info: 'bg-info/15 text-info',
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: StatusBadgeVariant;
}

export function StatusBadge({ className, variant = 'neutral', ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
