'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Account, Category, Debt, Settings } from '@/lib/types';

/**
 * Reference data that almost every form needs — the category list, the account
 * list, the currency symbol. It is read on the server and handed down once,
 * rather than each form fetching it, so a page never renders with a stale or
 * half-loaded category dropdown.
 */

export interface AppData {
  settings: Settings;
  categories: Category[];
  accounts: Account[];
  debts: Debt[];
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ value, children }: { value: AppData; children: ReactNode }) {
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const data = useContext(AppDataContext);
  if (!data) throw new Error('useAppData must be used inside <AppDataProvider>');
  return data;
}

/** Categories that represent consumed money, for the expense form's default list. */
export function useExpenseCategories(): Category[] {
  return useAppData().categories;
}
