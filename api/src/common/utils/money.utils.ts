import Decimal from 'decimal.js';
import { Currency } from '@prisma-client';

Decimal.set({ precision: 40 });

export const CURRENCY_DECIMALS: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  NGN: 2,
  AUD: 2,
  CAD: 2,
  CNY: 2,
  JPY: 0,
};

export function toSmallestUnit(amount: number, currency: Currency): bigint {
  const decimals = CURRENCY_DECIMALS[currency];
  return BigInt(
    new Decimal(amount)
      .mul(Decimal.pow(10, decimals))
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toString(),
  );
}

export function fromSmallestUnit(amount: bigint, currency: Currency): number {
  const decimals = CURRENCY_DECIMALS[currency];
  return new Decimal(amount.toString())
    .div(Decimal.pow(10, decimals))
    .toNumber();
}

// Always pass fxRate as a string — never a JS float literal.
// e.g. convertWithFxRate(100n, '150', Currency.USD, Currency.JPY) → 150n
// e.g. convertWithFxRate(1000n, '1.2345678', Currency.EUR, Currency.USD) → 1235n
export function convertWithFxRate(
  amountInSmallestUnit: bigint,
  fxRate: string,
  sourceCurrency: Currency,
  targetCurrency: Currency,
): bigint {
  const rate = new Decimal(fxRate);

  if (rate.isNaN() || !rate.isFinite() || rate.lte(0)) {
    throw new Error(`Invalid fxRate: "${fxRate}". Must be a positive finite number.`);
  }

  const decimalDiff =
    CURRENCY_DECIMALS[targetCurrency] - CURRENCY_DECIMALS[sourceCurrency];

  const converted = new Decimal(amountInSmallestUnit.toString())
    .mul(rate)
    .mul(Decimal.pow(10, decimalDiff))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return BigInt(converted.toString());
}
