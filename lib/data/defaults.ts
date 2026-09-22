import type { Account, Category, FinanceData, Settings } from '@/lib/types';

export const DATA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  currency: 'PKR',
  currencySymbol: 'Rs.',
  dateFormat: 'dd MMM yyyy',
  defaultMonth: 'current',
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food', type: 'expense', icon: 'utensils' },
  { id: 'transport', name: 'Transport', type: 'expense', icon: 'car' },
  { id: 'family', name: 'Family', type: 'expense', icon: 'users' },
  { id: 'home', name: 'Home', type: 'expense', icon: 'home' },
  { id: 'medical', name: 'Medical', type: 'expense', icon: 'pill' },
  { id: 'personal', name: 'Personal', type: 'expense', icon: 'user' },
  { id: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag' },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'film' },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', icon: 'repeat' },
  { id: 'work', name: 'Work', type: 'expense', icon: 'briefcase' },
  { id: 'miscellaneous', name: 'Miscellaneous', type: 'expense', icon: 'package' },
  { id: 'savings', name: 'Savings', type: 'savings', icon: 'piggy-bank' },
  { id: 'investment', name: 'Investment', type: 'investment', icon: 'trending-up' },
];

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'bank', name: 'Bank', icon: 'landmark', openingBalance: 0 },
  { id: 'cash', name: 'Cash', icon: 'banknote', openingBalance: 0 },
  { id: 'debit-card', name: 'Debit Card', icon: 'credit-card', openingBalance: 0 },
  { id: 'sadapay', name: 'SadaPay', icon: 'smartphone', openingBalance: 0 },
  { id: 'nayapay', name: 'NayaPay', icon: 'smartphone', openingBalance: 0 },
  { id: 'jazzcash', name: 'JazzCash', icon: 'smartphone', openingBalance: 0 },
];

/** A brand new, empty finance file: categories and accounts, no money yet. */
export function createEmptyData(): FinanceData {
  return {
    version: DATA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })),
    income: [],
    expenses: [],
    budgets: [],
    goals: [],
    debts: [],
    subscriptions: [],
    deposits: [],
    transfers: [],
  };
}
