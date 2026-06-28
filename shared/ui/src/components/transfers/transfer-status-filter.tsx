"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import {
    ALL_STATUSES,
    StatusFilter,
  TRANSFER_STATUSES,
  TRANSFER_STATUS_LABELS,
} from "@ledger/types";

interface TransferStatusFilterProps {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  id?: string;
}

export function TransferStatusFilter({
  value,
  onChange,
  id = "status-filter",
}: TransferStatusFilterProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Status</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as StatusFilter)}
      >
        <SelectTrigger id={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
          {TRANSFER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {TRANSFER_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
