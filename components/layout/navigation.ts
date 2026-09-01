import {
  ArrowLeftRight,
  ChartColumn,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Repeat,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** The sidebar, in order. Settings is separated below a rule. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/income', label: 'Income', icon: Wallet },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
  { href: '/budget', label: 'Budget', icon: ArrowLeftRight },
  { href: '/analytics', label: 'Analytics', icon: ChartColumn },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/accounts', label: 'Accounts', icon: CreditCard },
  { href: '/debts', label: 'Debts', icon: HandCoins },
];

export const SECONDARY_NAV: NavItem[] = [{ href: '/settings', label: 'Settings', icon: Settings }];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function titleForPath(pathname: string): string {
  const match = ALL_NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.label ?? 'My Finance';
}
