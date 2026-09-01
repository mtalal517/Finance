import { currentMonth, isValidMonth } from '../finance/dates';
import type { Settings } from '@/lib/types';

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/**
 * Which month a page is showing. The URL wins, so a month survives a refresh
 * and can be linked to; otherwise the user's default from Settings; otherwise
 * the real current month.
 */
export function resolveMonth(searchParams: SearchParams, settings: Settings): string {
  const requested = first(searchParams.month);
  if (isValidMonth(requested)) return requested;
  if (settings.defaultMonth !== 'current' && isValidMonth(settings.defaultMonth)) {
    return settings.defaultMonth;
  }
  return currentMonth();
}

export function param(searchParams: SearchParams, key: string): string {
  return first(searchParams[key]);
}
