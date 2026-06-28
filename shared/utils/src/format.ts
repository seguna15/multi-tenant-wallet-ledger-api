export function formatAccountNumber(raw: string): string {
  if (raw.length >= 6 && !raw.includes("-")) {
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }
  return raw;
}
