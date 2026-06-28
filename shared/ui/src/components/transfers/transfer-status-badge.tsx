import { Badge } from "../ui/badge";
import {
  TRANSFER_STATUS_BADGE_VARIANT,
  TRANSFER_STATUS_LABELS,
  type TransferStatus,
} from "@ledger/types";

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  return (
    <Badge variant={TRANSFER_STATUS_BADGE_VARIANT[status]}>
      {TRANSFER_STATUS_LABELS[status]}
    </Badge>
  );
}
