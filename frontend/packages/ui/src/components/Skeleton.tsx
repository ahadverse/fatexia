import { cn } from '../lib/cn';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  // motion-safe: the pulse is decoration, and a reduced-motion user should get a
  // static placeholder rather than a looping animation.
  return <div className={cn('motion-safe:animate-pulse rounded-md bg-muted', className)} />;
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

// Matches DataTable's row height so the layout doesn't jump when real rows arrive.
export function TableSkeleton({ rows = 6, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array.from({ length: columns }).map((__, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}
