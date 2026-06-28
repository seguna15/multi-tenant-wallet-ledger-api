"use client";

import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@ledger/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export type EntityFilterField<TFilters extends Record<string, string>> =
  | {
      type: "select";
      key: keyof TFilters;
      label: string;
      allValue: string;
      options: readonly string[];
      labels?: Record<string, string>;
      className?: string;
    }
  | {
      type: "dateRange";
      fromKey: keyof TFilters;
      toKey: keyof TFilters;
    }
  | {
      type: "search";
      key: keyof TFilters;
      label: string;
      placeholder?: string;
    };

interface EntityFilterBarProps<TFilters extends Record<string, string>> {
  fields: EntityFilterField<TFilters>[];
  filters: TFilters;
  onChange: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  className?: string;
}

export function EntityFilterBar<TFilters extends Record<string, string>>({
  fields,
  filters,
  onChange,
  className,
}: EntityFilterBarProps<TFilters>) {
  return (
    <div className={cn("flex flex-wrap items-end gap-4", className)}>
      {fields.map((field) => {
        switch (field.type) {
          case "select":
            return (
              <SelectField
                key={String(field.key)}
                field={field}
                value={filters[field.key]}
                onChange={onChange}
              />
            );
          case "dateRange":
            return (
              <DateRangeField
                key={`${String(field.fromKey)}-${String(field.toKey)}`}
                field={field}
                filters={filters}
                onChange={onChange}
              />
            );
          case "search":
            return (
              <SearchField
                key={String(field.key)}
                field={field}
                value={filters[field.key]}
                onChange={onChange}
              />
            );
        }
      })}
    </div>
  );
}

function SelectField<TFilters extends Record<string, string>>({
  field,
  value,
  onChange,
}: {
  field: Extract<EntityFilterField<TFilters>, { type: "select" }>;
  value: string;
  onChange: EntityFilterBarProps<TFilters>["onChange"];
}) {
  const id = `${String(field.key)}-filter`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <Select
        value={value}
        onValueChange={(v) =>
          onChange(field.key, v as TFilters[keyof TFilters])
        }
      >
        <SelectTrigger id={id} className={field.className ?? "w-40"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={field.allValue}>
            All {field.label.toLowerCase()}
          </SelectItem>
          {field.options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {field.labels?.[opt] ?? opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateRangeField<TFilters extends Record<string, string>>({
  field,
  filters,
  onChange,
}: {
  field: Extract<EntityFilterField<TFilters>, { type: "dateRange" }>;
  filters: TFilters;
  onChange: EntityFilterBarProps<TFilters>["onChange"];
}) {
  const from = filters[field.fromKey];
  const to = filters[field.toKey];
  const fromId = `${String(field.fromKey)}-filter`;
  const toId = `${String(field.toKey)}-filter`;

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={fromId}>From</Label>
        <Input
          id={fromId}
          type="date"
          value={from}
          onChange={(e) =>
            onChange(field.fromKey, e.target.value as TFilters[keyof TFilters])
          }
          max={to || undefined}
          className="w-40"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={toId}>To</Label>
        <Input
          id={toId}
          type="date"
          value={to}
          onChange={(e) =>
            onChange(field.toKey, e.target.value as TFilters[keyof TFilters])
          }
          min={from || undefined}
          className="w-40"
        />
      </div>
    </>
  );
}

function SearchField<TFilters extends Record<string, string>>({
  field,
  value,
  onChange,
}: {
  field: Extract<EntityFilterField<TFilters>, { type: "search" }>;
  value: string;
  onChange: EntityFilterBarProps<TFilters>["onChange"];
}) {
  const [draft, setDraft] = useState(value);
  const id = `${String(field.key)}-filter`;

  const commit = useCallback(
    () => onChange(field.key, draft.trim() as TFilters[keyof TFilters]),
    [field.key, draft, onChange],
  );

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <div className="flex gap-2">
        <div className="relative w-48">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id={id}
            placeholder={field.placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={commit}>
          Search
        </Button>
      </div>
    </div>
  );
}
