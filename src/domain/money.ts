export const toCents = (amount: number): number => Math.round(amount * 100);

export const fromCents = (cents: number): number => cents / 100;

export const hasAtMostTwoDecimals = (amount: number): boolean =>
  Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
