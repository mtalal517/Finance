'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, currentMonth, monthLabel, monthRange } from '@/lib/finance/dates';

/**
 * Month navigation, shared by every page scoped to a month. The month lives in
 * the URL rather than in component state, so it survives a refresh, follows you
 * between pages and can be bookmarked.
 */
export function MonthNav({ month, className = '' }: { month: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function goTo(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', next);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  // Two years back, six months forward — enough to review history and to plan
  // ahead without an unusable dropdown.
  const options = monthRange(addMonths(month, 6), 30);
  if (!options.includes(month)) options.push(month);
  const isCurrent = month === currentMonth();

  const step = 'flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40';

  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-xs ${className}`}>
      <button
        type="button"
        onClick={() => goTo(addMonths(month, -1))}
        aria-label={`Previous month, ${monthLabel(addMonths(month, -1))}`}
        disabled={pending}
        className={step}
      >
        <ChevronLeft size={15} strokeWidth={2} aria-hidden />
      </button>

      <select
        value={month}
        onChange={(event) => goTo(event.target.value)}
        aria-label="Select month"
        disabled={pending}
        className="w-[8.75rem] cursor-pointer appearance-none rounded-md bg-transparent px-1 py-1 text-center text-base font-medium text-ink outline-none transition-colors hover:bg-sunken disabled:opacity-60"
      >
        {[...new Set(options)]
          .sort()
          .reverse()
          .map((value) => (
            <option key={value} value={value}>
              {monthLabel(value)}
            </option>
          ))}
      </select>

      <button
        type="button"
        onClick={() => goTo(addMonths(month, 1))}
        aria-label={`Next month, ${monthLabel(addMonths(month, 1))}`}
        disabled={pending}
        className={step}
      >
        <ChevronRight size={15} strokeWidth={2} aria-hidden />
      </button>

      {!isCurrent && (
        <button
          type="button"
          onClick={() => goTo(currentMonth())}
          className="ml-0.5 rounded-md px-2 py-1 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
        >
          Today
        </button>
      )}
    </div>
  );
}
