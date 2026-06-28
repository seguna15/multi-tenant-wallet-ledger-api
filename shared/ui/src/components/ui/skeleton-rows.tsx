interface SkeletonRowsProps {
  count?: number;
}

export function SkeletonRows({ count = 5 }: SkeletonRowsProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-muted h-12 animate-pulse rounded-lg border"
        />
      ))}
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
}

/** Matches a grid of MetaCard / summary cards (e.g. overview, tenant detail). */
export function SkeletonCards({ count = 3 }: SkeletonCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border p-5 shadow-sm">
          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
          <div className="bg-muted mt-3 h-6 w-32 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonStatsProps {
  count?: number;
}

/** Matches a row of top-level KPI/stat cards (4-up on desktop). */
export function SkeletonStats({ count = 4 }: SkeletonStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border p-5 shadow-sm">
          <div className="bg-muted h-4 w-20 animate-pulse rounded" />
          <div className="bg-muted mt-3 h-7 w-16 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
