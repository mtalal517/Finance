'use client';

import { formatCurrency } from '@/lib/finance/format';

/**
 * One tooltip shell for every chart. Values sit in ink, never in the series
 * colour — the swatch beside the label carries identity.
 */

export interface TooltipRow {
  name: string;
  value: number;
  color: string;
}

export function ChartTooltipCard({
  title,
  rows,
  symbol,
  footer,
}: {
  title: string;
  rows: TooltipRow[];
  symbol: string;
  footer?: string;
}) {
  return (
    <div className="pointer-events-none rounded-lg border border-line bg-surface px-3 py-2 shadow-md">
      <p className="mb-1.5 text-sm font-semibold text-ink">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-2 text-sm">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="flex-1 whitespace-nowrap text-ink-soft">{row.name}</span>
            <span className="tnum font-medium text-ink">
              {formatCurrency(row.value, { currencySymbol: symbol })}
            </span>
          </div>
        ))}
      </div>
      {footer && <p className="mt-1.5 border-t border-line pt-1.5 text-xs text-muted">{footer}</p>}
    </div>
  );
}
