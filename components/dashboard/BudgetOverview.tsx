import Link from 'next/link';
import { ChevronRight, Wallet } from 'lucide-react';
import { Badge, EmptyState, IconTile, ProgressBar } from '@/components/ui/Primitives';
import { iconFor } from '@/lib/icons/registry';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import type { BudgetRow, BudgetStatus } from '@/lib/finance/calculations';

const STATUS: Record<BudgetStatus, { label: string; tone: 'positive' | 'warning' | 'danger' | 'neutral' }> = {
  good: { label: 'On track', tone: 'positive' },
  warning: { label: 'Close to limit', tone: 'warning' },
  over: { label: 'Over budget', tone: 'danger' },
  unbudgeted: { label: 'No budget', tone: 'neutral' },
};

const BAR_TONE = {
  good: 'positive',
  warning: 'warning',
  over: 'danger',
  unbudgeted: 'neutral',
} as const;

/**
 * The budget list. Each row links into the category drill-down, which is the
 * answer to "what did that money actually go on?" — so the whole row is the
 * target, with a chevron to say so.
 */
export function BudgetOverview({
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
        icon={Wallet}
        title="No budget for this month"
        body="Set an amount for each category and this is where you will watch it being used up."
        action={
          <Link
            href={`/budget?month=${month}`}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-base font-medium text-white shadow-xs transition-colors hover:bg-primary-hover"
          >
            Create a budget
          </Link>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const Icon = iconFor(row.category.icon);
        const status = STATUS[row.status];
        return (
          <li key={row.category.id}>
            <Link
              href={`/budget/${row.category.id}?month=${month}`}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken/60"
            >
              <IconTile icon={Icon} />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  {/* The badge rides with the name so the figures below stay in
                      one column whether or not a row has one. */}
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-base font-medium text-ink">{row.category.name}</span>
                    {row.status !== 'good' && <Badge tone={status.tone}>{status.label}</Badge>}
                  </span>
                  <span className="tnum shrink-0 text-base text-muted">
                    <span className="font-medium text-ink">{formatCurrency(row.spent, { currencySymbol: symbol })}</span>
                    {row.budget > 0 && <> / {formatCurrency(row.budget, { currencySymbol: symbol })}</>}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2.5">
                  <ProgressBar
                    percent={row.percentUsed}
                    tone={BAR_TONE[row.status]}
                    className="flex-1"
                    label={`${row.category.name} budget used`}
                  />
                  <span className="tnum w-9 shrink-0 text-right text-xs text-muted">
                    {row.budget > 0 ? formatPercent(row.percentUsed, 0) : '—'}
                  </span>
                </div>
              </div>

              <ChevronRight
                size={15}
                strokeWidth={2}
                aria-hidden
                className="shrink-0 text-line-strong transition-colors group-hover:text-muted"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
