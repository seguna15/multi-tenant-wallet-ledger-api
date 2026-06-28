import { Loader2 } from "lucide-react";
import { cn } from "@ledger/utils";

type SpinnerProps = React.ComponentProps<typeof Loader2>;

export function Spinner({ className, ...props }: SpinnerProps) {
  return <Loader2 className={cn("animate-spin", className)} {...props} />;
}
