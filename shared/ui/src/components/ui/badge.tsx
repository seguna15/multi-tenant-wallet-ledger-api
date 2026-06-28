import { cn } from "@ledger/utils";

interface BadgeProps extends React.ComponentPropsWithoutRef<"span"> {
  children: React.ReactNode;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "success"
    | "secondary"
    | "info"
    | "warning";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        variant === "default" && "bg-primary/10 text-primary",
        variant === "destructive" && "bg-destructive/10 text-destructive",
        variant === "outline" && "text-foreground border",
        variant === "success" && "bg-emerald-500/10 text-emerald-500",
        variant === "secondary" && "bg-muted text-muted-foreground",
        variant === "info" && "bg-blue-100 text-blue-700",
        variant === "warning" && "bg-yellow-100 text-yellow-700",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
