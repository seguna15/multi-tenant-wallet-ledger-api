export function WalletListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse space-y-4 rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div className="bg-muted h-5 w-12 rounded" />
            <div className="bg-muted h-5 w-16 rounded-full" />
          </div>
          <div className="bg-muted h-8 w-28 rounded" />
          <div className="bg-muted h-3 w-36 rounded" />
          <div className="bg-muted h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}
