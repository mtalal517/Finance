import type { Settings } from '@/lib/types';

/**
 * Currency formatting lives in one place so `Rs. 110,000` looks identical on
 * every page. Whole amounts drop the decimals — real budgets are rarely to the
 * paisa, and `Rs. 110,000` reads better than `Rs. 110,000.00`.
 */

const DEFAULT_SYMBOL = 'Rs.';

export function formatNumber(amount: number, decimals?: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const dp = decimals ?? (Number.isInteger(safe) ? 0 : 2);
  return safe.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function formatCurrency(
  amount: number,
  settings?: Pick<Settings, 'currencySymbol'> | null,
  options: { decimals?: number; signed?: boolean } = {},
): string {
  const symbol = settings?.currencySymbol || DEFAULT_SYMBOL;
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : options.signed && safe > 0 ? '+' : '';
  return `${sign}${symbol} ${formatNumber(Math.abs(safe), options.decimals)}`;
}

/** Axis labels and tight cards: `Rs. 110k`, `Rs. 1.2M`. */
export function formatCompactCurrency(
  amount: number,
  settings?: Pick<Settings, 'currencySymbol'> | null,
): string {
  const symbol = settings?.currencySymbol || DEFAULT_SYMBOL;
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${symbol} ${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${symbol} ${trim(abs / 1_000)}k`;
  return `${sign}${symbol} ${formatNumber(abs)}`;
}

function trim(value: number): string {
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Number(value.toFixed(decimals));
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(decimals)}%`;
}

/** Guards the divide-by-zero that a 0 budget or a first month would otherwise cause. */
export function safePercent(part: number, whole: number): number {
  if (!whole) return 0;
  const pct = (part / whole) * 100;
  return Number.isFinite(pct) ? pct : 0;
}
