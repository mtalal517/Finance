import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/finance/format';

/**
 * The row of headline figures at the top of a page.
 *
 * One bordered surface divided into cells, rather than a row of separate cards:
 * these figures belong to the same month and read as a single summary, and four
 * extra card outlines would say otherwise. The dividers come from a 1px grid gap
 * over a line-coloured background, which stays clean however the grid wraps.
 */

type Tone = 'default' | 'positive' | 'warning' | 'danger';

const VALUE_TONES: Record<Tone, string> = {
  default: 'text-ink',
  positive: 'text-positive',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function StatStrip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`surface overflow-hidden ${className}`}>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))] lg:grid-flow-col">
        {children}
      </div>
    </div>
  );
}

export function StatItem({
  label,
  amount,
  symbol,
  tone = 'default',
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  amount?: number;
  symbol?: string;
  tone?: Tone;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Replaces the formatted amount, for figures that are not currency. */
  children?: ReactNode;
}) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={13} strokeWidth={1.9} className="shrink-0 text-muted" aria-hidden />}
        <p className="label truncate">{label}</p>
      </div>
      <p className={`tnum mt-1.5 text-lg font-semibold ${VALUE_TONES[tone]}`}>
        {children ?? formatCurrency(amount ?? 0, symbol ? { currencySymbol: symbol } : null)}
      </p>
      {hint && <p className="mt-0.5 text-sm leading-snug text-muted">{hint}</p>}
    </div>
  );
}
