'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard } from './ChartTooltip';
import { CHART_INK } from '@/lib/finance/chartPalette';
import { formatCompactCurrency, formatCurrency } from '@/lib/finance/format';
import { shortMonthLabel } from '@/lib/finance/dates';
import { iconFor } from '@/lib/icons/registry';

/**
 * The time-series charts.
 *
 * Both forms share one y-axis — measures of different scale get their own chart
 * rather than a second axis, which is the fastest way to make a chart lie.
 */

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

/**
 * Any row keyed by month. The series definitions say which of its other fields
 * to plot, so a caller can hand over a richer object than the chart needs.
 */
export interface TrendPoint {
  month: string;
}

function ChartLegend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function useTooltip(series: SeriesDef[], symbol: string) {
  return function renderTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltipCard
        title={shortMonthLabel(String(label))}
        symbol={symbol}
        rows={series.map((s) => ({
          name: s.name,
          value: Number(payload.find((p: any) => p.dataKey === s.key)?.value ?? 0),
          color: s.color,
        }))}
      />
    );
  };
}

const AXIS_PROPS = {
  stroke: CHART_INK.axis,
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: CHART_INK.axis },
  tickMargin: 6,
} as const;

export function MonthlyBars({
  data,
  series,
  symbol,
  height = 240,
}: {
  data: TrendPoint[];
  series: SeriesDef[];
  symbol: string;
  height?: number;
}) {
  const renderTooltip = useTooltip(series, symbol);

  return (
    <div>
      <ChartLegend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            <XAxis dataKey="month" tickFormatter={(m: string) => shortMonthLabel(m).slice(0, 3)} {...AXIS_PROPS} />
            <YAxis
              width={72}
              tickFormatter={(value: number) => formatCompactCurrency(value, { currencySymbol: symbol })}
              {...AXIS_PROPS}
            />
            <Tooltip cursor={{ fill: CHART_INK.grid, opacity: 0.6 }} content={renderTooltip} />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                // Rounded data-end, anchored flat to the baseline.
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MonthlyLine({
  data,
  series,
  symbol,
  height = 240,
}: {
  data: TrendPoint[];
  series: SeriesDef[];
  symbol: string;
  height?: number;
}) {
  const renderTooltip = useTooltip(series, symbol);

  return (
    <div>
      <ChartLegend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            <XAxis dataKey="month" tickFormatter={(m: string) => shortMonthLabel(m).slice(0, 3)} {...AXIS_PROPS} />
            <YAxis
              width={72}
              tickFormatter={(value: number) => formatCompactCurrency(value, { currencySymbol: symbol })}
              {...AXIS_PROPS}
            />
            <Tooltip cursor={{ stroke: CHART_INK.axis, strokeDasharray: '3 3' }} content={renderTooltip} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                // A surface-coloured ring keeps a marker legible where lines cross.
                dot={{ r: 3.5, fill: s.color, stroke: CHART_INK.surface, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: s.color, stroke: CHART_INK.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Ranked category spending. One hue on purpose — identity is already carried by
 * the row labels, so a rainbow here would encode nothing.
 */
export function CategoryRankBars({
  rows,
  symbol,
}: {
  rows: { id: string; label: string; icon: string; amount: number }[];
  symbol: string;
}) {
  const max = rows.reduce((best, row) => Math.max(best, row.amount), 0);

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const Icon = iconFor(row.icon);
        return (
          <li key={row.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
                <Icon size={13} strokeWidth={1.9} className="shrink-0 text-muted" aria-hidden />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="tnum shrink-0 font-medium text-ink">
                {formatCurrency(row.amount, { currencySymbol: symbol })}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-ink-soft"
                style={{ width: `${max > 0 ? Math.max(2, (row.amount / max) * 100) : 0}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
