export default function TransferLoading() {
  return (
    <div className="mx-auto max-w-lg animate-pulse space-y-6">
      <div className="bg-muted h-8 w-48 rounded" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border p-6">
          <div className="bg-muted h-4 w-32 rounded" />
          <div className="bg-muted h-10 w-full rounded" />
        </div>
      ))}
      <div className="bg-muted h-10 w-full rounded" />
    </div>
  );
}
