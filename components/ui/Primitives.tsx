import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** The shared presentational pieces. Every page composes from these. */

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <section className={`surface ${padded ? 'p-5' : ''} ${className}`}>{children}</section>;
}

/**
 * A card header. `border` draws the rule used when the body below is a table or
 * list that runs to the card's edges.
 */
export function CardHeader({
  title,
  subtitle,
  action,
  border = false,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  border?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${
        border ? 'border-b border-line px-5 py-3.5' : 'mb-4'
      } ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

type BadgeTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'accent';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-ink-soft',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent-ink',
};

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {Icon && <Icon size={11} strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  );
}

/**
 * A budget bar. It caps the fill at 100% but turns red past it — a bar that
 * silently stops at full would hide overspending, which is the one thing this
 * component exists to show.
 */
export function ProgressBar({
  percent,
  tone = 'neutral',
  className = '',
  label,
}: {
  percent: number;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  className?: string;
  label?: string;
}) {
  const fill = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const colors = {
    neutral: 'bg-ink-soft',
    positive: 'bg-positive',
    warning: 'bg-warning',
    danger: 'bg-danger',
  } as const;

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(fill)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${colors[tone]}`}
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}

/**
 * An empty state that does something: it explains why the space is empty and
 * offers the action that would fill it.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${compact ? 'py-8' : 'py-14'}`}>
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-sunken text-muted">
        <Icon size={17} strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** The framed icon used for a category or an account throughout the app. */
export function IconTile({
  icon: Icon,
  size = 'md',
  className = '',
}: {
  icon: LucideIcon;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const box = size === 'sm' ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-lg';
  return (
    <span
      className={`flex shrink-0 items-center justify-center border border-line bg-sunken text-ink-soft ${box} ${className}`}
    >
      <Icon size={size === 'sm' ? 13 : 15} strokeWidth={1.9} aria-hidden />
    </span>
  );
}

/** A definition row: label left, figure right. Used inside cards. */
export function DetailRow({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'danger' | 'muted';
}) {
  const tones = {
    default: 'text-ink',
    positive: 'text-positive',
    danger: 'text-danger',
    muted: 'text-ink-soft',
  } as const;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-sm text-muted">
        {label}
        {hint && <span className="block truncate text-xs text-muted/80">{hint}</span>}
      </dt>
      <dd className={`tnum shrink-0 text-sm font-medium ${tones[tone]}`}>{value}</dd>
    </div>
  );
}
