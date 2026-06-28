export type Currency = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'AUD' | 'CAD' | 'CNY' | 'JPY';

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

export const CURRENCIES: Currency[] = Object.keys(CURRENCY_DECIMALS) as Currency[];

export const ALL_CURRENCIES = 'ALL' as const;

export type CurrencyFilter = Currency | typeof ALL_CURRENCIES;

const CURRENCY_SCALE: Record<Currency, bigint> = Object.fromEntries(
  (Object.entries(CURRENCY_DECIMALS) as [Currency, number][]).map(([c, d]) => [
    c,
    BigInt(10 ** d),
  ]),
) as Record<Currency, bigint>;

export function toSmallestUnit(amount: number, currency: Currency): bigint {
  const scale = CURRENCY_SCALE[currency];
  const shifted = Math.round(amount * Number(scale));
  return BigInt(shifted);
}

export function fromSmallestUnit(amount: bigint, currency: Currency): number {
  const scale = CURRENCY_SCALE[currency];
  const whole = amount / scale;
  const remainder = amount % scale;
  return Number(whole) + Number(remainder) / Number(scale);
}

export function convertWithFxRate(
  amountInSmallestUnit: bigint,
  fxRate: string,
  sourceCurrency: Currency,
  targetCurrency: Currency,
): bigint {
  const rate = parseFloat(fxRate);
  if (!isFinite(rate) || isNaN(rate) || rate <= 0) {
    throw new Error(`Invalid fxRate: "${fxRate}". Must be a positive finite number.`);
  }

  const decimalDiff =
    CURRENCY_DECIMALS[targetCurrency] - CURRENCY_DECIMALS[sourceCurrency];
  const scaleFactor = 10 ** Math.abs(decimalDiff);

  let converted: number;
  if (decimalDiff >= 0) {
    converted = Number(amountInSmallestUnit) * rate * scaleFactor;
  } else {
    converted = (Number(amountInSmallestUnit) * rate) / scaleFactor;
  }

  return BigInt(Math.round(converted));
}

export function formatCurrency(
  amount: bigint,
  currency: Currency,
  locale = 'en-US',
): string {
  const value = fromSmallestUnit(amount, currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: CURRENCY_DECIMALS[currency],
    maximumFractionDigits: CURRENCY_DECIMALS[currency],
  }).format(value);
}

export function getCurrencySymbol(currency: string, locale = 'en-US'): string {
  return (
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  );
}
