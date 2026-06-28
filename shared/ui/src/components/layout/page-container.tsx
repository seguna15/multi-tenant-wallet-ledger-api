import { cn } from "@ledger/utils";

/**
 * Consistent page-level padding and max-width. Centers content on large
 * screens while staying full-width with safe padding on mobile.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Standard page title + optional description + action buttons.
 * Stacks vertically on mobile, switches to a row on sm+ so action
 * buttons (e.g. "Export CSV", "Rotate key") sit beside the title on desktop.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
