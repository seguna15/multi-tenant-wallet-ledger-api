import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { randomInt } from 'crypto';


export function generateAccountNumber(tenantId: string): string {
  const prefix = tenantId.replace(/-/g, '').slice(0, 4).toUpperCase();
  const digits = String(randomInt(0, 10_000_000_000)).padStart(10, '0');
  return `${prefix}${digits}`;
}

export function isUniqueConstraintViolation(
  err: unknown,
  field: string,
): boolean {
  return (
    err instanceof PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes(field)
  );
}
