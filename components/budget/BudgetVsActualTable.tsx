import Link from 'next/link';
import { ChartNoAxesColumn, ChevronRight } from 'lucide-react';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/Primitives';
import { iconFor } from '@/lib/icons/registry';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import type { BudgetRow, BudgetStatus } from '@/lib/finance/calculations';

const STATUS: Record<BudgetStatus, { label: string; tone: 'positive' | 'warning' | 'danger' | 'neutral' }> = {
  good: { label: 'On track', tone: 'positive' },
  warning: { label: 'Near limit', tone: 'warning' },
  over: { label: 'Over', tone: 'danger' },
  unbudgeted: { label: 'No budget', tone: 'neutral' },
};

const BAR_TONE = {
  good: 'positive',
  warning: 'warning',
  over: 'danger',
  unbudgeted: 'neutral',
} as const;

/**
 * Budget against what actually happened. Every figure here is derived from
 * transactions at render time — none of it is stored.
 */
export function BudgetVsActualTable({
  rows,
  month,
  symbol,
}: {
  rows: BudgetRow[];
  month: string;
  symbol: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ChartNoAxesColumn}
        title="Nothing to compare yet"
        body="Once you have set some allocations above and recorded a few expenses, this is where they meet."
      />
    );
  }

  return (
    <>
      {/* Desktop */}
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="table-head border-b border-line">
            <th scope="col" className="px-5 py-2.5 font-medium">Category</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Budget</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Spent</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Left</th>
            <th scope="col" className="w-44 px-3 py-2.5 font-medium">Used</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const Icon = iconFor(row.category.icon);
            return (
              <tr key={row.category.id} className="group transition-colors hover:bg-sunken/50">
                <td className="px-5 py-2.5">
                  <Link
                    href={`/budget/${row.category.id}?month=${month}`}
                    className="flex items-center gap-2 font-medium text-ink"
                  >
                    <Icon size={15} strokeWidth={1.9} className="shrink-0 text-muted" aria-hidden />
                    <span className="truncate group-hover:underline">{row.category.name}</span>
                    {row.transactionCount > 0 && (
                      <span className="text-sm font-normal text-muted">
                        · {row.transactionCount} txn{row.transactionCount === 1 ? '' : 's'}
                      </span>
                    )}
                    <ChevronRight
                      size={13}
                      strokeWidth={2}
                      aria-hidden
                      className="text-line-strong transition-colors group-hover:text-muted"
                    />
                  </Link>
                </td>
                <td className="tnum px-3 py-2.5 text-right whitespace-nowrap text-ink-soft">
                  {row.budget > 0 ? formatCurrency(row.budget, { currencySymbol: symbol }) : '—'}
                </td>
                <td className="tnum px-3 py-2.5 text-right font-medium whitespace-nowrap text-ink">
                  {formatCurrency(row.spent, { currencySymbol: symbol })}
                </td>
                <td
                  className={`tnum px-3 py-2.5 text-right whitespace-nowrap ${
                    row.budget === 0 ? 'text-muted' : row.remaining < 0 ? 'font-medium text-danger' : 'text-ink-soft'
                  }`}
                >
                  {row.budget > 0 ? formatCurrency(row.remaining, { currencySymbol: symbol }) : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      percent={row.percentUsed}
                      tone={BAR_TONE[row.status]}
                      className="flex-1"
                      label={`${row.category.name} used`}
                    />
                    <span className="tnum w-9 shrink-0 text-right text-xs text-muted">
                      {row.budget > 0 ? formatPercent(row.percentUsed, 0) : '—'}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-2.5 whitespace-nowrap">
                  <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => {
          const Icon = iconFor(row.category.icon);
          return (
            <li key={row.category.id}>
              <Link href={`/budget/${row.category.id}?month=${month}`} className="block px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-base font-medium text-ink">
                    <Icon size={14} strokeWidth={1.9} className="shrink-0 text-muted" aria-hidden />
                    <span className="truncate">{row.category.name}</span>
                  </span>
                  <span className="tnum shrink-0 text-base text-muted">
                    <span className="font-medium text-ink">{formatCurrency(row.spent, { currencySymbol: symbol })}</span>
                    {row.budget > 0 && <> / {formatCurrency(row.budget, { currencySymbol: symbol })}</>}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar percent={row.percentUsed} tone={BAR_TONE[row.status]} className="flex-1" />
                  <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
