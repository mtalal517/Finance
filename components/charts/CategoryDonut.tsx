'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltipCard } from './ChartTooltip';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import { CHART_INK } from '@/lib/finance/chartPalette';
import { iconFor } from '@/lib/icons/registry';

/**
 * Where the month's spending went.
 *
 * The legend below it is the required relief for the lighter hues and doubles
 * as the table view: every slice is named, valued and given its share in text,
 * so nothing is communicated by colour alone. It sits below rather than beside
 * the ring because this card lives in a narrow column, where a side-by-side
 * legend collapses and takes the names with it.
 */

export interface DonutSlice {
  id: string;
  label: string;
  /** An icon name; see `lib/icons/names.ts`. */
  icon: string;
  amount: number;
  percent: number;
  color: string;
}

export function CategoryDonut({
  slices,
  total,
  symbol,
}: {
  slices: DonutSlice[];
  total: number;
  symbol: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              // A 2px surface-coloured gap keeps neighbouring slices apart.
              stroke={CHART_INK.surface}
              strokeWidth={2}
              paddingAngle={slices.length > 1 ? 1.5 : 0}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.id} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const slice = payload[0].payload as DonutSlice;
                return (
                  <ChartTooltipCard
                    title={slice.label}
                    symbol={symbol}
                    rows={[{ name: 'Spent', value: slice.amount, color: slice.color }]}
                    footer={`${formatPercent(slice.percent, 0)} of this month's expenses`}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* The headline the ring exists to support. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="label">Spent</span>
          <span className="tnum text-base font-semibold text-ink">
            {formatCurrency(total, { currencySymbol: symbol })}
          </span>
        </div>
      </div>

      <ul className="min-w-0 space-y-1.5">
        {slices.map((slice) => {
          const Icon = iconFor(slice.icon);
          return (
            <li key={slice.id} className="flex items-center gap-2.5 text-sm">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <Icon size={13} strokeWidth={1.9} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink-soft">{slice.label}</span>
              <span className="tnum shrink-0 font-medium text-ink">
                {formatCurrency(slice.amount, { currencySymbol: symbol })}
              </span>
              <span className="tnum w-9 shrink-0 text-right text-muted">{formatPercent(slice.percent, 0)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
