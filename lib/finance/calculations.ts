import type {
  Account,
  Category,
  Debt,
  FinanceData,
  Goal,
  IncomeEntry,
  IncomeType,
  Transaction,
} from '@/lib/types';
import { addMonths, daysUntil, monthOf, monthRange, todayIso, yearOf } from './dates';
import { safePercent } from './format';

/**
 * Every number the app displays is computed here.
 *
 * Nothing in this file reads the disk and nothing mutates its input, so the
 * dashboard, the budget page, the category drill-down and analytics all reach
 * the same answer by construction — there is only one implementation to be
 * right or wrong. If a page needs a new number, it gets a function here rather
 * than a local sum.
 */

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function sum(values: number[]): number {
  return round2(values.reduce((total, v) => total + v, 0));
}

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

export function categoryIndex(data: FinanceData): Map<string, Category> {
  return new Map(data.categories.map((c) => [c.id, c]));
}

export function accountIndex(data: FinanceData): Map<string, Account> {
  return new Map(data.accounts.map((a) => [a.id, a]));
}

/** A placeholder for rows whose category was deleted, so nothing renders blank. */
export const UNKNOWN_CATEGORY: Category = {
  id: '__unknown__',
  name: 'Uncategorised',
  type: 'expense',
  icon: 'package',
};

// ---------------------------------------------------------------------------
// Slicing by month
// ---------------------------------------------------------------------------

/** Outgoing money only — repayments received are not spending. */
export function outgoingInMonth(data: FinanceData, month: string): Transaction[] {
  return data.expenses.filter((t) => t.direction === 'out' && monthOf(t.date) === month);
}

export function incomeInMonth(data: FinanceData, month: string): IncomeEntry[] {
  return data.income.filter((i) => monthOf(i.date) === month);
}

export function budgetForMonth(data: FinanceData, month: string): Record<string, number> {
  return data.budgets.find((b) => b.month === month)?.categories ?? {};
}

/** Every month that has any activity, oldest first. Drives month pickers. */
export function activeMonths(data: FinanceData): string[] {
  const months = new Set<string>();
  for (const t of data.expenses) months.add(monthOf(t.date));
  for (const i of data.income) months.add(monthOf(i.date));
  for (const b of data.budgets) months.add(b.month);
  return [...months].sort();
}

// ---------------------------------------------------------------------------
// Month summary
// ---------------------------------------------------------------------------

export interface MonthSummary {
  month: string;
  income: number;
  incomeByType: Record<IncomeType, number>;
  /** Money consumed — categories of type `expense` only. */
  expenses: number;
  /** Money set aside — categories of type `savings`. Never counted as spending. */
  savings: number;
  /** Money moved into investments — categories of type `investment`. */
  investments: number;
  /** expenses + savings + investments: everything that left the wallet. */
  outflow: number;
  /** Income that has not been spent, saved or invested yet. */
  remaining: number;
  /** Every outgoing row in the month, transfers to savings included. */
  transactionCount: number;
  /** Only the rows that count as spending — what the Expenses figure is made of. */
  expenseTransactionCount: number;
  /** Portion of income kept as savings, as a percentage. */
  savingsRate: number;
}

const EMPTY_INCOME_BY_TYPE: Record<IncomeType, number> = {
  salary: 0,
  bonus: 0,
  freelance: 0,
  other: 0,
};

export function getMonthSummary(data: FinanceData, month: string): MonthSummary {
  const categories = categoryIndex(data);
  const transactions = outgoingInMonth(data, month);

  let expenses = 0;
  let savings = 0;
  let investments = 0;
  let expenseCount = 0;

  for (const t of transactions) {
    const type = (t.categoryId && categories.get(t.categoryId)?.type) || 'expense';
    if (type === 'savings') savings += t.amount;
    else if (type === 'investment') investments += t.amount;
    else {
      expenses += t.amount;
      expenseCount += 1;
    }
  }

  const incomeByType = { ...EMPTY_INCOME_BY_TYPE };
  let income = 0;
  for (const entry of incomeInMonth(data, month)) {
    income += entry.amount;
    incomeByType[entry.type] += entry.amount;
  }

  expenses = round2(expenses);
  savings = round2(savings);
  investments = round2(investments);
  income = round2(income);
  const outflow = round2(expenses + savings + investments);

  return {
    month,
    income,
    incomeByType: {
      salary: round2(incomeByType.salary),
      bonus: round2(incomeByType.bonus),
      freelance: round2(incomeByType.freelance),
      other: round2(incomeByType.other),
    },
    expenses,
    savings,
    investments,
    outflow,
    remaining: round2(income - outflow),
    transactionCount: transactions.length,
    expenseTransactionCount: expenseCount,
    savingsRate: safePercent(savings, income),
  };
}

// ---------------------------------------------------------------------------
// Budget vs actual
// ---------------------------------------------------------------------------

export type BudgetStatus = 'good' | 'warning' | 'over' | 'unbudgeted';

export interface BudgetRow {
  category: Category;
  budget: number;
  spent: number;
  /** Negative once the category is overspent. */
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
  transactionCount: number;
}

export interface BudgetOverview {
  month: string;
  income: number;
  totalAllocated: number;
  /** Income the budget has not assigned to any category. Negative means over-allocated. */
  unallocated: number;
  totalSpent: number;
  rows: BudgetRow[];
  /** Rows for categories of type `expense` only — what the dashboard shows. */
  expenseRows: BudgetRow[];
  hasBudget: boolean;
}

function statusFor(budget: number, spent: number): BudgetStatus {
  if (budget <= 0) return spent > 0 ? 'unbudgeted' : 'good';
  const used = (spent / budget) * 100;
  if (used > 100) return 'over';
  if (used >= 70) return 'warning';
  return 'good';
}

export function getBudgetVsActual(data: FinanceData, month: string): BudgetOverview {
  const allocations = budgetForMonth(data, month);
  const transactions = outgoingInMonth(data, month);

  const spentByCategory = new Map<string, { amount: number; count: number }>();
  for (const t of transactions) {
    if (!t.categoryId) continue;
    const entry = spentByCategory.get(t.categoryId) ?? { amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    spentByCategory.set(t.categoryId, entry);
  }

  // A row appears if it has an allocation or any spending — an untouched,
  // unbudgeted category would only be noise.
  const relevant = new Set([...Object.keys(allocations), ...spentByCategory.keys()]);

  const rows: BudgetRow[] = data.categories
    .filter((c) => relevant.has(c.id))
    .map((category) => {
      const budget = round2(allocations[category.id] ?? 0);
      const found = spentByCategory.get(category.id);
      const spent = round2(found?.amount ?? 0);
      return {
        category,
        budget,
        spent,
        remaining: round2(budget - spent),
        percentUsed: safePercent(spent, budget),
        status: statusFor(budget, spent),
        transactionCount: found?.count ?? 0,
      };
    });

  const summary = getMonthSummary(data, month);
  const totalAllocated = sum(Object.values(allocations));

  return {
    month,
    income: summary.income,
    totalAllocated,
    unallocated: round2(summary.income - totalAllocated),
    totalSpent: summary.outflow,
    rows,
    expenseRows: rows.filter((r) => r.category.type === 'expense'),
    hasBudget: Object.keys(allocations).length > 0,
  };
}

// ---------------------------------------------------------------------------
// Category drill-down — "what did I spend my Transport budget on?"
// ---------------------------------------------------------------------------

export interface CategoryDetail {
  category: Category;
  month: string;
  budget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
  transactions: Transaction[];
  transactionCount: number;
  averageTransaction: number;
  largest: Transaction | null;
  /** Same category, previous month — for the "vs last month" line. */
  previousMonthSpent: number;
}

export function getCategoryDetail(
  data: FinanceData,
  month: string,
  categoryId: string,
): CategoryDetail | null {
  const category = data.categories.find((c) => c.id === categoryId);
  if (!category) return null;

  const transactions = outgoingInMonth(data, month)
    .filter((t) => t.categoryId === categoryId)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));

  const budget = round2(budgetForMonth(data, month)[categoryId] ?? 0);
  const spent = sum(transactions.map((t) => t.amount));
  const previousMonthSpent = sum(
    outgoingInMonth(data, addMonths(month, -1))
      .filter((t) => t.categoryId === categoryId)
      .map((t) => t.amount),
  );

  const largest = transactions.reduce<Transaction | null>(
    (best, t) => (best === null || t.amount > best.amount ? t : best),
    null,
  );

  return {
    category,
    month,
    budget,
    spent,
    remaining: round2(budget - spent),
    percentUsed: safePercent(spent, budget),
    status: statusFor(budget, spent),
    transactions,
    transactionCount: transactions.length,
    averageTransaction: transactions.length ? round2(spent / transactions.length) : 0,
    largest,
    previousMonthSpent,
  };
}

/** Share of the month's outflow per category, for the donut chart. */
export interface CategorySlice {
  category: Category;
  amount: number;
  percent: number;
  count: number;
}

export function getCategoryBreakdown(
  data: FinanceData,
  month: string,
  options: { include?: Category['type'][] } = {},
): CategorySlice[] {
  const include = options.include ?? ['expense'];
  const categories = categoryIndex(data);
  const totals = new Map<string, { amount: number; count: number }>();

  for (const t of outgoingInMonth(data, month)) {
    const category = (t.categoryId && categories.get(t.categoryId)) || null;
    if (!category || !include.includes(category.type)) continue;
    const entry = totals.get(category.id) ?? { amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    totals.set(category.id, entry);
  }

  const total = sum([...totals.values()].map((v) => v.amount));

  return [...totals.entries()]
    .map(([categoryId, value]) => ({
      category: categories.get(categoryId) ?? UNKNOWN_CATEGORY,
      amount: round2(value.amount),
      percent: safePercent(value.amount, total),
      count: value.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

export interface EnrichedTransaction extends Transaction {
  category: Category | null;
  account: Account | null;
}

export function enrichTransactions(data: FinanceData, transactions: Transaction[]): EnrichedTransaction[] {
  const categories = categoryIndex(data);
  const accounts = accountIndex(data);
  return transactions.map((t) => ({
    ...t,
    category: (t.categoryId && categories.get(t.categoryId)) || null,
    account: (t.accountId && accounts.get(t.accountId)) || null,
  }));
}

/** Newest first. Ties on date are broken by entry order so the newest edit leads. */
export function sortByDateDesc<T extends { date: string; createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
  );
}

export function getRecentTransactions(
  data: FinanceData,
  month: string | null,
  limit = 8,
): EnrichedTransaction[] {
  const pool = month
    ? data.expenses.filter((t) => monthOf(t.date) === month)
    : data.expenses;
  return enrichTransactions(data, sortByDateDesc(pool).slice(0, limit));
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface AccountBalance {
  account: Account;
  openingBalance: number;
  incomeIn: number;
  /** Everything paid out of this account, including debt repayments. */
  paidOut: number;
  /** Repayments received on money owed to you, deposited here. */
  receivedIn: number;
  currentBalance: number;
  transactionCount: number;
}

export function getAccountBalances(data: FinanceData): AccountBalance[] {
  const balances = new Map<string, AccountBalance>(
    data.accounts.map((account) => [
      account.id,
      {
        account,
        openingBalance: round2(account.openingBalance),
        incomeIn: 0,
        paidOut: 0,
        receivedIn: 0,
        currentBalance: round2(account.openingBalance),
        transactionCount: 0,
      },
    ]),
  );

  for (const entry of data.income) {
    if (!entry.accountId) continue;
    const balance = balances.get(entry.accountId);
    if (!balance) continue;
    balance.incomeIn += entry.amount;
    balance.transactionCount += 1;
  }

  for (const t of data.expenses) {
    if (!t.accountId) continue;
    const balance = balances.get(t.accountId);
    if (!balance) continue;
    if (t.direction === 'in') balance.receivedIn += t.amount;
    else balance.paidOut += t.amount;
    balance.transactionCount += 1;
  }

  return [...balances.values()].map((b) => ({
    ...b,
    incomeIn: round2(b.incomeIn),
    paidOut: round2(b.paidOut),
    receivedIn: round2(b.receivedIn),
    currentBalance: round2(b.openingBalance + b.incomeIn + b.receivedIn - b.paidOut),
  }));
}

export function getTotalBalance(data: FinanceData): number {
  return sum(getAccountBalances(data).map((b) => b.currentBalance));
}

/** Money not tied to any account — useful for spotting untracked cash. */
export function getUnassignedTotals(data: FinanceData): { income: number; spending: number } {
  return {
    income: sum(data.income.filter((i) => !i.accountId).map((i) => i.amount)),
    spending: sum(
      data.expenses.filter((t) => !t.accountId && t.direction === 'out').map((t) => t.amount),
    ),
  };
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface GoalProgress {
  goal: Goal;
  currentAmount: number;
  targetAmount: number;
  remaining: number;
  percentComplete: number;
  isComplete: boolean;
  daysRemaining: number | null;
  isOverdue: boolean;
  /** What you would need to put aside each month to land on the target date. */
  requiredPerMonth: number | null;
}

export function getGoalProgress(goal: Goal): GoalProgress {
  const contributed = sum(goal.contributions.map((c) => c.amount));
  const currentAmount = round2(goal.initialAmount + contributed);
  const remaining = round2(Math.max(0, goal.targetAmount - currentAmount));
  const isComplete = currentAmount >= goal.targetAmount;

  const days = goal.targetDate ? daysUntil(goal.targetDate) : null;
  const monthsLeft = days === null ? null : Math.max(0, days / 30.44);

  return {
    goal,
    currentAmount,
    targetAmount: goal.targetAmount,
    remaining,
    percentComplete: Math.min(100, safePercent(currentAmount, goal.targetAmount)),
    isComplete,
    daysRemaining: days,
    isOverdue: days !== null && days < 0 && !isComplete,
    requiredPerMonth:
      monthsLeft === null || isComplete ? null : round2(remaining / Math.max(1, monthsLeft)),
  };
}

export function getGoalsProgress(data: FinanceData): GoalProgress[] {
  return data.goals.map(getGoalProgress);
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export type DebtStatus = 'settled' | 'partial' | 'outstanding' | 'overdue';

export interface DebtProgress {
  debt: Debt;
  paid: number;
  outstanding: number;
  percentPaid: number;
  status: DebtStatus;
  payments: Transaction[];
  daysUntilDue: number | null;
}

/** Repayments are ordinary transactions carrying a `debtId`, never a second ledger. */
export function getDebtProgress(data: FinanceData, debt: Debt): DebtProgress {
  const payments = sortByDateDesc(data.expenses.filter((t) => t.debtId === debt.id));
  const paid = sum(payments.map((t) => t.amount));
  const outstanding = round2(Math.max(0, debt.amount - paid));
  const days = debt.dueDate ? daysUntil(debt.dueDate) : null;

  let status: DebtStatus;
  if (outstanding <= 0) status = 'settled';
  else if (days !== null && days < 0) status = 'overdue';
  else if (paid > 0) status = 'partial';
  else status = 'outstanding';

  return {
    debt,
    paid,
    outstanding,
    percentPaid: Math.min(100, safePercent(paid, debt.amount)),
    status,
    payments,
    daysUntilDue: days,
  };
}

export interface DebtOverview {
  payable: DebtProgress[];
  receivable: DebtProgress[];
  totalOwed: number;
  totalOwedToYou: number;
  /** Positive when people owe you more than you owe. */
  net: number;
  overdueCount: number;
}

export function getDebtOverview(data: FinanceData): DebtOverview {
  const all = data.debts.map((debt) => getDebtProgress(data, debt));
  const rank: Record<DebtStatus, number> = { overdue: 0, outstanding: 1, partial: 2, settled: 3 };
  const order = (a: DebtProgress, b: DebtProgress) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    const aDue = a.debt.dueDate ?? '9999-12-31';
    const bDue = b.debt.dueDate ?? '9999-12-31';
    return aDue.localeCompare(bDue);
  };

  const payable = all.filter((d) => d.debt.direction === 'payable').sort(order);
  const receivable = all.filter((d) => d.debt.direction === 'receivable').sort(order);

  const totalOwed = sum(payable.map((d) => d.outstanding));
  const totalOwedToYou = sum(receivable.map((d) => d.outstanding));

  return {
    payable,
    receivable,
    totalOwed,
    totalOwedToYou,
    net: round2(totalOwedToYou - totalOwed),
    overdueCount: all.filter((d) => d.status === 'overdue').length,
  };
}

// ---------------------------------------------------------------------------
// Trends over time
// ---------------------------------------------------------------------------

export interface MonthPoint {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  investments: number;
  net: number;
}

export function getMonthlySeries(data: FinanceData, months: string[]): MonthPoint[] {
  return months.map((month) => {
    const s = getMonthSummary(data, month);
    return {
      month,
      income: s.income,
      expenses: s.expenses,
      savings: s.savings,
      investments: s.investments,
      net: s.remaining,
    };
  });
}

/** The trailing window analytics charts use by default. */
export function getTrailingSeries(data: FinanceData, month: string, count = 6): MonthPoint[] {
  return getMonthlySeries(data, monthRange(month, count));
}

export interface YearSummary {
  year: string;
  income: number;
  expenses: number;
  savings: number;
  investments: number;
  net: number;
  monthsWithActivity: number;
  averageMonthlyExpense: number;
  averageMonthlyIncome: number;
}

export function getYearSummary(data: FinanceData, year: string): YearSummary {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const points = getMonthlySeries(data, months);
  const active = points.filter((p) => p.income > 0 || p.expenses > 0 || p.savings > 0 || p.investments > 0);

  const income = sum(points.map((p) => p.income));
  const expenses = sum(points.map((p) => p.expenses));
  const savings = sum(points.map((p) => p.savings));
  const investments = sum(points.map((p) => p.investments));

  return {
    year,
    income,
    expenses,
    savings,
    investments,
    net: round2(income - expenses - savings - investments),
    monthsWithActivity: active.length,
    averageMonthlyExpense: active.length ? round2(expenses / active.length) : 0,
    averageMonthlyIncome: active.length ? round2(income / active.length) : 0,
  };
}

export function availableYears(data: FinanceData): string[] {
  const years = new Set(activeMonths(data).map(yearOf));
  if (years.size === 0) years.add(todayIso().slice(0, 4));
  return [...years].sort().reverse();
}

// ---------------------------------------------------------------------------
// Month-over-month comparison
// ---------------------------------------------------------------------------

export interface Comparison {
  current: number;
  previous: number;
  change: number;
  percentChange: number;
  direction: 'up' | 'down' | 'flat';
}

export function compare(current: number, previous: number): Comparison {
  const change = round2(current - previous);
  return {
    current,
    previous,
    change,
    percentChange: safePercent(Math.abs(change), previous),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  };
}

export function getSpendingComparison(data: FinanceData, month: string): Comparison & { previousMonth: string } {
  const previousMonth = addMonths(month, -1);
  const current = getMonthSummary(data, month).expenses;
  const previous = getMonthSummary(data, previousMonth).expenses;
  return { ...compare(current, previous), previousMonth };
}

// ---------------------------------------------------------------------------
// Rule-based insights — plain arithmetic, no model, no API
// ---------------------------------------------------------------------------

export type InsightTone = 'positive' | 'warning' | 'negative' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
}

export function getInsights(data: FinanceData, month: string): Insight[] {
  const insights: Insight[] = [];
  const summary = getMonthSummary(data, month);
  const previous = getMonthSummary(data, addMonths(month, -1));
  const hasHistory = previous.income > 0 || previous.outflow > 0;

  if (summary.income === 0 && summary.outflow === 0) return insights;

  // Savings rate.
  if (summary.income > 0) {
    const rate = summary.savingsRate;
    const kept = safePercent(summary.income - summary.expenses, summary.income);
    if (rate > 0) {
      insights.push({
        id: 'savings-rate',
        tone: rate >= 20 ? 'positive' : 'neutral',
        text: `You have saved ${rate.toFixed(0)}% of your income this month.`,
      });
    }
    if (summary.expenses > summary.income) {
      insights.push({
        id: 'overspend',
        tone: 'negative',
        text: `You spent more than you earned this month by ${fmt(summary.expenses - summary.income)}.`,
      });
    } else if (kept >= 50) {
      insights.push({
        id: 'kept',
        tone: 'positive',
        text: `You kept ${kept.toFixed(0)}% of your income after expenses.`,
      });
    }
  }

  // Biggest category.
  const breakdown = getCategoryBreakdown(data, month);
  const top = breakdown[0];
  if (top) {
    insights.push({
      id: 'top-category',
      tone: 'neutral',
      text: `Your highest spending category this month is ${top.category.name}, at ${top.percent.toFixed(0)}% of expenses.`,
    });
  }

  // Category movement versus last month — the single largest mover.
  if (hasHistory) {
    const previousBreakdown = new Map(
      getCategoryBreakdown(data, addMonths(month, -1)).map((s) => [s.category.id, s.amount]),
    );
    let mover: { name: string; percent: number; up: boolean } | null = null;
    for (const slice of breakdown) {
      const before = previousBreakdown.get(slice.category.id) ?? 0;
      if (before <= 0) continue;
      const pct = safePercent(Math.abs(slice.amount - before), before);
      if (pct >= 10 && (mover === null || pct > mover.percent)) {
        mover = { name: slice.category.name, percent: pct, up: slice.amount > before };
      }
    }
    if (mover) {
      insights.push({
        id: 'category-move',
        tone: mover.up ? 'warning' : 'positive',
        text: `Your ${mover.name.toLowerCase()} spending is ${mover.percent.toFixed(0)}% ${mover.up ? 'higher' : 'lower'} than last month.`,
      });
    }

    const spend = compare(summary.expenses, previous.expenses);
    if (spend.direction !== 'flat' && previous.expenses > 0) {
      insights.push({
        id: 'total-move',
        tone: spend.direction === 'up' ? 'warning' : 'positive',
        text: `Total spending is ${spend.percentChange.toFixed(0)}% ${spend.direction === 'up' ? 'higher' : 'lower'} than last month.`,
      });
    }
  }

  // Budget pressure.
  const budget = getBudgetVsActual(data, month);
  const over = budget.expenseRows.filter((r) => r.status === 'over');
  if (over.length > 0) {
    const names = over.map((r) => r.category.name).join(', ');
    insights.push({
      id: 'over-budget',
      tone: 'negative',
      text:
        over.length === 1
          ? `${names} is over budget by ${fmt(Math.abs(over[0].remaining))}.`
          : `${over.length} categories are over budget: ${names}.`,
    });
  } else if (budget.hasBudget) {
    const nearing = budget.expenseRows.filter((r) => r.status === 'warning');
    if (nearing.length > 0) {
      insights.push({
        id: 'near-budget',
        tone: 'warning',
        text: `${nearing.map((r) => r.category.name).join(', ')} ${nearing.length === 1 ? 'is' : 'are'} close to the budget limit.`,
      });
    }
  }

  // Long-run average.
  const year = getYearSummary(data, yearOf(month));
  if (year.monthsWithActivity >= 2) {
    insights.push({
      id: 'average',
      tone: 'neutral',
      text: `Your average monthly expense in ${year.year} is ${fmt(year.averageMonthlyExpense)}.`,
    });
  }

  // Debt.
  const debts = getDebtOverview(data);
  if (debts.overdueCount > 0) {
    insights.push({
      id: 'debt-overdue',
      tone: 'negative',
      text: `${debts.overdueCount} debt${debts.overdueCount === 1 ? ' is' : 's are'} past the due date.`,
    });
  } else if (debts.totalOwed > 0) {
    const open = debts.payable.filter((d) => d.outstanding > 0).length;
    insights.push({
      id: 'debt-owed',
      tone: 'neutral',
      text: `You still owe ${fmt(debts.totalOwed)} across ${open} debt${open === 1 ? '' : 's'}.`,
    });
  }

  return insights;

  // Insights read as sentences, so amounts are rounded to whole units — the
  // paisa in "Rs. 50,933.2" adds nothing to "your average monthly expense".
  function fmt(value: number): string {
    return `${data.settings.currencySymbol} ${Math.round(value).toLocaleString('en-US')}`;
  }
}
