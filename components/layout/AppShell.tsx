'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Menu, Plus, X } from 'lucide-react';
import { useExpenseModal } from '@/components/expenses/ExpenseModalProvider';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { PRIMARY_NAV, SECONDARY_NAV, titleForPath, type NavItem } from './navigation';

/**
 * A fixed sidebar on desktop; the same list in a slide-over drawer on mobile.
 * The selected month rides along in the query string, so moving from Dashboard
 * to Budget keeps you in the month you were looking at.
 */

function useMonthPreservingHref() {
  const searchParams = useSearchParams();
  const month = searchParams.get('month');
  return (href: string) => (month ? `${href}?month=${month}` : href);
}

function NavLink({
  item,
  active,
  onNavigate,
  href,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  href: string;
}) {
  const { icon: Icon } = item;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-base font-medium transition-colors duration-150 ${
        active ? 'bg-sunken text-ink' : 'text-ink-soft hover:bg-sunken/70 hover:text-ink'
      }`}
    >
      <Icon
        size={16}
        strokeWidth={1.9}
        aria-hidden
        className={`shrink-0 transition-colors ${active ? 'text-ink' : 'text-muted group-hover:text-ink-soft'}`}
      />
      {item.label}
    </Link>
  );
}

function NavList({ onNavigate, showSignOut }: { onNavigate?: () => void; showSignOut: boolean }) {
  const pathname = usePathname();
  const withMonth = useMonthPreservingHref();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            href={withMonth(item.href)}
            active={isActive(item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
      <div className="mt-3 space-y-0.5 border-t border-line px-3 pt-3">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} href={item.href} active={isActive(item.href)} onNavigate={onNavigate} />
        ))}
        {/* Only shown when a password is set — there is nothing to sign out of
            when the app is running open on your own machine. */}
        {showSignOut && <SignOutButton onDone={onNavigate} />}
      </div>
    </>
  );
}

function AddExpenseButton({ onDone, className = '' }: { onDone?: () => void; className?: string }) {
  const { addExpense } = useExpenseModal();
  return (
    <button
      type="button"
      onClick={() => {
        addExpense();
        onDone?.();
      }}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-base font-medium text-white shadow-xs transition-colors duration-150 hover:bg-primary-hover ${className}`}
    >
      <Plus size={15} strokeWidth={2.25} aria-hidden />
      Add expense
    </button>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white"
      >
        F
      </span>
      <span className="text-base font-semibold tracking-tight text-ink">My Finance</span>
    </div>
  );
}

function ShellChrome({ children, showSignOut }: { children: ReactNode; showSignOut: boolean }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A route change should always leave the drawer closed behind you.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface py-4 lg:flex">
        <div className="px-5 pb-5">
          <Wordmark />
        </div>
        <NavList showSignOut={showSignOut} />
        <div className="mt-3 px-3">
          <AddExpenseButton className="w-full" />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/90 px-3 py-2.5 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
        >
          <Menu size={18} strokeWidth={1.9} aria-hidden />
        </button>
        <span className="flex-1 truncate text-base font-semibold text-ink">{titleForPath(pathname)}</span>
        <AddExpenseButton className="!h-8 !px-2.5 !text-sm" />
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-ink/25" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="animate-drawer-in relative flex h-full w-64 max-w-[82vw] flex-col border-r border-line bg-surface py-4 shadow-lg">
            <div className="flex items-center justify-between px-5 pb-5">
              <Wordmark />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="-mr-1 rounded-md p-1 text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <NavList onNavigate={() => setDrawerOpen(false)} showSignOut={showSignOut} />
            <div className="mt-3 px-3">
              <AddExpenseButton className="w-full" onDone={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 lg:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children, showSignOut = false }: { children: ReactNode; showSignOut?: boolean }) {
  return (
    <Suspense fallback={null}>
      <ShellChrome showSignOut={showSignOut}>{children}</ShellChrome>
    </Suspense>
  );
}
