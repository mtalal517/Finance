import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import { monthLabel } from '@/lib/finance/dates';
import type { Comparison, Insight } from '@/lib/finance/calculations';

/**
 * The month in words: how spending moved against last month, then the
 * rule-based observations.
 *
 * These were two cards. They are one now — both answer "how is this month
 * going?", and splitting them added a box without adding a thought.
 *
 * Down is the good direction here because this compares *expenses*. The arrow
 * and the wording carry that too, so colour is never doing the work alone.
 */
export function MonthNotes({
  comparison,
  month,
  previousMonth,
  symbol,
  insights,
}: {
  comparison: Comparison;
  month: string;
  previousMonth: string;
  symbol: string;
  insights: Insight[];
}) {
  const { direction, percentChange, current, previous } = comparison;
  const noBaseline = previous === 0;

  const Arrow = direction === 'down' ? ArrowDownRight : direction === 'up' ? ArrowUpRight : Minus;
  const tone =
    noBaseline || direction === 'flat' ? 'text-muted' : direction === 'down' ? 'text-positive' : 'text-warning';

  const DOTS = {
    positive: 'bg-positive',
    warning: 'bg-warning',
    negative: 'bg-danger',
    neutral: 'bg-line-strong',
  } as const;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{monthLabel(month)}</span>
        <span className="tnum text-lg font-semibold text-ink">
          {formatCurrency(current, { currencySymbol: symbol })}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{monthLabel(previousMonth)}</span>
        <span className="tnum text-base text-ink-soft">{formatCurrency(previous, { currencySymbol: symbol })}</span>
      </div>

      <p className={`mt-3 flex items-center gap-1.5 text-sm font-medium ${tone}`}>
        {noBaseline ? (
          <span className="font-normal">No spending in {monthLabel(previousMonth)} to compare against.</span>
        ) : direction === 'flat' ? (
          <>
            <Arrow size={14} strokeWidth={2} aria-hidden />
            <span>Exactly level with last month</span>
          </>
        ) : (
          <>
            <Arrow size={14} strokeWidth={2} aria-hidden />
            <span>
              {formatPercent(percentChange, 0)} {direction === 'down' ? 'less' : 'more'} than last month
            </span>
          </>
        )}
      </p>

      {insights.length > 0 && (
        <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
          {insights.map((insight) => (
            <li key={insight.id} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
              <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[insight.tone]}`} />
              {insight.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
