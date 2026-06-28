export const bigIntReplacer = (_key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? value.toString() : value;

export const safeStringify = (value: unknown): string =>
  JSON.stringify(value, bigIntReplacer);
