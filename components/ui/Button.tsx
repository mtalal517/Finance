import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

/**
 * The only button in the app.
 *
 * Four variants, two sizes, one height rhythm shared with inputs so controls
 * line up when they sit side by side. `primary` is a solid near-black rather
 * than a brand colour — colour is reserved for what money is doing.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-xs hover:bg-primary-hover active:bg-primary disabled:hover:bg-primary',
  secondary:
    'border border-line-strong bg-surface text-ink shadow-xs hover:bg-sunken active:bg-line/60 disabled:hover:bg-surface',
  ghost: 'text-ink-soft hover:bg-sunken hover:text-ink active:bg-line/60',
  danger: 'bg-danger text-white shadow-xs hover:brightness-110 active:brightness-95',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-sm',
  md: 'h-9 gap-2 px-3.5 text-base',
};

const ICON_SIZE: Record<Size, number> = { sm: 14, md: 16 };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  /** Renders a square button with no label; `aria-label` becomes required. */
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconOnly = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const iconSize = ICON_SIZE[size];

  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-[background-color,color,box-shadow,filter] duration-150 disabled:pointer-events-none disabled:opacity-50 ${
        VARIANTS[variant]
      } ${iconOnly ? (size === 'sm' ? 'h-8 w-8 px-0' : 'h-9 w-9 px-0') : SIZES[size]} ${className}`}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={iconSize} strokeWidth={2} aria-hidden />
      )}
      {!iconOnly && children}
    </button>
  );
}
