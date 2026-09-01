import type { DateFormat } from '@/lib/types';

/**
 * Month keys are `YYYY-MM` strings and dates are `YYYY-MM-DD` strings.
 *
 * Everything here is deliberately string arithmetic rather than Date maths.
 * A `new Date('2026-09-01')` is parsed as UTC midnight, which in Pakistan
 * (UTC+5) is still 5am on the 1st — but west of Greenwich it is the previous
 * day, and expenses would silently land in the wrong month. Strings have no
 * timezone, so they cannot drift.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidMonth(month: string): boolean {
  return MONTH_PATTERN.test(month);
}

/** True only for a real calendar date — rejects 2026-02-30. */
export function isValidDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today in the machine's local timezone, as `YYYY-MM-DD`. */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

/** The `YYYY-MM` a `YYYY-MM-DD` belongs to. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function yearOf(monthOrDate: string): string {
  return monthOrDate.slice(0, 4);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const monthIndex = total - year * 12;
  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** `2026-09` -> `September 2026`. */
export function monthLabel(month: string): string {
  if (!isValidMonth(month)) return month;
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** `2026-09` -> `Sep 2026`. */
export function shortMonthLabel(month: string): string {
  if (!isValidMonth(month)) return month;
  const [y, m] = month.split('-').map(Number);
  return `${SHORT_MONTHS[m - 1]} ${y}`;
}

/** The last `count` months ending at `month`, oldest first. */
export function monthRange(month: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(addMonths(month, -i));
  return out;
}

export function formatDate(date: string, format: DateFormat = 'dd MMM yyyy'): string {
  if (!DATE_PATTERN.test(date)) return date;
  const [y, m, d] = date.split('-');
  const monthIndex = Number(m) - 1;
  const short = SHORT_MONTHS[monthIndex] ?? m;
  switch (format) {
    case 'dd/MM/yyyy':
      return `${d}/${m}/${y}`;
    case 'yyyy-MM-dd':
      return date;
    case 'MM/dd/yyyy':
      return `${m}/${d}/${y}`;
    case 'dd MMM yyyy':
    default:
      return `${d} ${short} ${y}`;
  }
}

/** Compact form used in dense transaction lists: `22 Sep`. */
export function formatDayMonth(date: string): string {
  if (!DATE_PATTERN.test(date)) return date;
  const [, m, d] = date.split('-');
  return `${d} ${SHORT_MONTHS[Number(m) - 1] ?? m}`;
}

/** Negative when the date is in the past. Used for debt due dates. */
export function daysUntil(date: string, from: string = todayIso()): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
