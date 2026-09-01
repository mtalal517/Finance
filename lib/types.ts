/**
 * The complete shape of `data/finance.json`.
 *
 * Rule for this file: nothing here is a *calculated* value. Balances, totals,
 * "spent", "remaining" and goal/debt progress are all derived at read time by
 * `lib/finance/calculations.ts`. If you are tempted to add a field that could
 * be computed from other fields, don't — it will drift.
 */

export type CategoryType = 'expense' | 'savings' | 'investment';

export interface Category {
  id: string;
  name: string;
  /**
   * Drives how money in this category is classified everywhere in the app.
   * `expense`    — money consumed (food, fuel, rent).
   * `savings`    — money set aside for later.
   * `investment` — money moved into an investment.
   * Savings and investment are never counted as spending.
   */
  type: CategoryType;
  icon: string;
}

export interface Account {
  id: string;
  name: string;
  icon: string;
  openingBalance: number;
}

export type IncomeType = 'salary' | 'bonus' | 'freelance' | 'other';

export interface IncomeEntry {
  id: string;
  /** ISO date, `YYYY-MM-DD`. The month it belongs to is derived from this. */
  date: string;
  type: IncomeType;
  description: string;
  amount: number;
  /** Which account the money landed in. Optional. */
  accountId: string | null;
  createdAt: string;
}

/**
 * One money movement. `direction` is almost always `out`; the sole exception is
 * a repayment received on money someone owed you, which flows `in`.
 * Amounts are always stored positive — the direction carries the sign.
 */
export type TransactionDirection = 'out' | 'in';

export interface Transaction {
  id: string;
  amount: number;
  /** Required for outgoing money; null for a repayment received. */
  categoryId: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  description: string;
  accountId: string | null;
  notes: string;
  direction: TransactionDirection;
  /** Set when this row is a debt repayment, linking it back to the debt. */
  debtId: string | null;
  createdAt: string;
}

export interface Budget {
  id: string;
  /** `YYYY-MM`. */
  month: string;
  /** categoryId -> allocated amount. */
  categories: Record<string, number>;
}

export interface GoalContribution {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  /** Money already in the goal when it was created. Progress adds contributions. */
  initialAmount: number;
  targetDate: string | null;
  description: string;
  createdAt: string;
  contributions: GoalContribution[];
}

/** `payable` — you owe them. `receivable` — they owe you. */
export type DebtDirection = 'payable' | 'receivable';

export interface Debt {
  id: string;
  person: string;
  direction: DebtDirection;
  amount: number;
  /** When the debt was incurred. */
  date: string;
  dueDate: string | null;
  description: string;
  notes: string;
  createdAt: string;
}

export type DateFormat = 'dd MMM yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy';

export interface Settings {
  currency: string;
  currencySymbol: string;
  dateFormat: DateFormat;
  /** `current` follows today's date; otherwise a pinned `YYYY-MM`. */
  defaultMonth: string;
}

export interface FinanceData {
  version: number;
  settings: Settings;
  categories: Category[];
  accounts: Account[];
  income: IncomeEntry[];
  expenses: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
}
