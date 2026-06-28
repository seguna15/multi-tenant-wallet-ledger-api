import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@ledger/utils";

const gridVariants = cva("grid gap-4", {
  variants: {
    cols: {
      /** 4-up KPI row: matches SkeletonStats */
      stats: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      /** 2-3 up card grid: matches overview's MetaCard grid and SkeletonCards */
      cards: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      /** Side-by-side detail panels on desktop, stacked on mobile/tablet */
      twoCol: "grid-cols-1 lg:grid-cols-2",
    },
  },
  defaultVariants: {
    cols: "cards",
  },
});

interface ResponsiveGridProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gridVariants> {}

export function ResponsiveGrid({
  className,
  cols,
  ...props
}: ResponsiveGridProps) {
  return <div className={cn(gridVariants({ cols }), className)} {...props} />;
}
