import Link from 'next/link';
import { ChevronRight, Wallet } from 'lucide-react';
import { Badge, EmptyState, IconTile, ProgressBar } from '@/components/ui/Primitives';
import { iconFor } from '@/lib/icons/registry';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import type { BudgetRow, BudgetStatus } from '@/lib/finance/calculations';

type Tone = 'positive' | 'warning' | 'danger' | 'neutral';

const SPENDING_STATUS: Record<BudgetStatus, { label: string; tone: Tone } | null> = {
  good: null,
  warning: { label: 'Close to limit', tone: 'warning' },
  over: { label: 'Over budget', tone: 'danger' },
  unbudgeted: { label: 'No budget', tone: 'neutral' },
};

/**
 * A set-aside row is a pot, so its figures read the other way round: the
 * allocation filled it and transactions empty it. `over` means drawn past what
 * was set aside — the excess is plain spending.
 */
const SET_ASIDE_STATUS: Record<BudgetStatus, { label: string; tone: Tone } | null> = {
  good: null,
  warning: { label: 'Running low', tone: 'warning' },
  over: { label: 'Overdrawn', tone: 'danger' },
  unbudgeted: { label: 'Not set aside', tone: 'neutral' },
};

const SPENDING_BAR: Record<BudgetStatus, Tone> = {
  good: 'positive',
  warning: 'warning',
  over: 'danger',
  unbudgeted: 'neutral',
};

const SET_ASIDE_BAR: Record<BudgetStatus, Tone> = {
  good: 'positive',
  warning: 'warning',
  over: 'danger',
  unbudgeted: 'neutral',
};

type RowKind = 'spending' | 'set-aside';

/**
 * The budget list. Each row links into the category drill-down, which is the
 * answer to "what did that money actually go on?" — so the whole row is the
 * target, with a chevron to say so.
 *
 * Savings and investment allocations are listed under their own heading, and
 * counted down rather than up: allocating to one is what sets the money aside,
 * so the figure worth showing is how much of the pot is still there.
 */
export function BudgetOverview({
  rows,
  setAsideRows = [],
  month,
  symbol,
}: {
  rows: BudgetRow[];
  setAsideRows?: BudgetRow[];
  month: string;
  symbol: string;
}) {
  if (rows.length === 0 && setAsideRows.length === 0) {
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
    <>
      {rows.length > 0 && (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <Row key={row.category.id} row={row} kind="spending" month={month} symbol={symbol} />
          ))}
        </ul>
      )}

      {setAsideRows.length > 0 && (
        <>
          <p className="label border-y border-line bg-sunken/50 px-5 py-1.5">
            Set aside — what is left in each pot
          </p>
          <ul className="divide-y divide-line">
            {setAsideRows.map((row) => (
              <Row key={row.category.id} row={row} kind="set-aside" month={month} symbol={symbol} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Row({
  row,
  kind,
  month,
  symbol,
}: {
  row: BudgetRow;
  kind: RowKind;
  month: string;
  symbol: string;
}) {
  const Icon = iconFor(row.category.icon);
  const setAside = kind === 'set-aside';
  const badge = (setAside ? SET_ASIDE_STATUS : SPENDING_STATUS)[row.status];
  const barTone = (setAside ? SET_ASIDE_BAR : SPENDING_BAR)[row.status];

  // A spending row fills up as it is used; a pot empties.
  const figure = setAside ? Math.max(0, row.remaining) : row.spent;
  const percent = setAside ? Math.max(0, 100 - row.percentUsed) : row.percentUsed;

  return (
    <li>
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
              {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
            </span>
            <span className="tnum shrink-0 text-base text-muted">
              <span className="font-medium text-ink">{formatCurrency(figure, { currencySymbol: symbol })}</span>
              {row.budget > 0 && (
                <>
                  {' '}
                  / {formatCurrency(row.budget, { currencySymbol: symbol })}
                  {setAside && ' left'}
                </>
              )}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2.5">
            <ProgressBar
              percent={percent}
              tone={barTone}
              className="flex-1"
              label={setAside ? `${row.category.name} left` : `${row.category.name} budget used`}
            />
            <span className="tnum w-9 shrink-0 text-right text-xs text-muted">
              {row.budget > 0 ? formatPercent(percent, 0) : '—'}
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
}
