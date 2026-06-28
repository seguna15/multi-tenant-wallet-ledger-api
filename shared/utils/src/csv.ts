export function toCsv<T extends object>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  options: { includeHeader?: boolean } = {},
): string {
  const { includeHeader = true } = options;

  const escape = (value: unknown) => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const rowLines = rows.map((row) =>
    columns.map((c) => escape(row[c.key])).join(","),
  );

  if (!includeHeader) return rowLines.join("\n");

  const header = columns.map((c) => escape(c.label)).join(",");
  return [header, ...rowLines].join("\n");
}

export function downloadCsv(filename: string, data: string | Blob): void {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: "text/csv;charset=utf-8;" })
      : data;
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
