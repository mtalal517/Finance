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
  /** Set when this row was written by paying a subscription. */
  subscriptionId: string | null;
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

/**
 * Money placed into an account, optionally tagged with what it is for.
 *
 * Neither income nor spending: it does not enter the month's arithmetic at all.
 * It says where money sits and, when you care to say, which category or savings
 * pot it belongs to — the one thing a transaction cannot express, since a
 * transaction has an account it came *out* of and never one it went *into*.
 */
export interface Deposit {
  id: string;
  accountId: string;
  amount: number;
  /** The category or savings pot this money is set against. Optional. */
  categoryId: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  note: string;
  createdAt: string;
}

/** How often a subscription is charged. */
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

/**
 * A recurring charge the app remembers, so it can tell you what you are
 * committed to and what falls due next. Paying one writes an ordinary
 * transaction — there is no separate subscription ledger to drift.
 */
export interface Subscription {
  id: string;
  name: string;
  /** Charged once per `cycle`, not per month. */
  amount: number;
  cycle: BillingCycle;
  /** ISO date, `YYYY-MM-DD`. Advances by one cycle each time it is paid. */
  nextDueDate: string;
  /** The budget category a payment is recorded against. */
  categoryId: string | null;
  /** The account a payment comes out of. */
  accountId: string | null;
  icon: string;
  /** Paused subscriptions stay listed but cost nothing. */
  active: boolean;
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
  subscriptions: Subscription[];
  deposits: Deposit[];
}
