import { createEmptyData, DATA_VERSION, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults';
import { DEFAULT_ACCOUNT_ICON, DEFAULT_CATEGORY_ICON, resolveIconName } from '../icons/names';
import type {
  Account,
  Budget,
  Category,
  CategoryType,
  DateFormat,
  Debt,
  DebtDirection,
  FinanceData,
  Goal,
  GoalContribution,
  IncomeEntry,
  IncomeType,
  Settings,
  Transaction,
  TransactionDirection,
} from '@/lib/types';

/**
 * Turns anything at all into a usable FinanceData.
 *
 * This is the repair layer between the disk and the rest of the app: a
 * hand-edited file, an old export, or a partially-written file all come out the
 * other side as a valid structure. Rows that cannot be repaired are dropped
 * rather than throwing, so one bad expense never costs the user their file.
 *
 * Deliberately free of `server-only` so the test suite can exercise it directly.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** Money is stored as a non-negative number rounded to 2dp; anything else becomes 0. */
function money(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function isoDate(value: unknown, fallback: string): string {
  const s = str(value);
  if (ISO_DATE.test(s) && !Number.isNaN(Date.parse(s))) return s;
  return fallback;
}

function optionalIsoDate(value: unknown): string | null {
  const s = str(value);
  if (ISO_DATE.test(s) && !Number.isNaN(Date.parse(s))) return s;
  return null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ensures every row has a unique, non-empty id. */
function uniqueId(seen: Set<string>, candidate: unknown, prefix: string): string {
  let id = str(candidate).trim();
  if (!id || seen.has(id)) {
    let n = seen.size + 1;
    do {
      id = `${prefix}_${n}`;
      n += 1;
    } while (seen.has(id));
  }
  seen.add(id);
  return id;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeSettings(value: unknown): Settings {
  const raw = isObject(value) ? value : {};
  const formats: DateFormat[] = ['dd MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
  const dateFormat = formats.includes(raw.dateFormat as DateFormat)
    ? (raw.dateFormat as DateFormat)
    : DEFAULT_SETTINGS.dateFormat;
  const defaultMonth = str(raw.defaultMonth, 'current');
  return {
    currency: str(raw.currency, DEFAULT_SETTINGS.currency).slice(0, 8) || DEFAULT_SETTINGS.currency,
    currencySymbol:
      str(raw.currencySymbol, DEFAULT_SETTINGS.currencySymbol).slice(0, 8) || DEFAULT_SETTINGS.currencySymbol,
    dateFormat,
    defaultMonth: defaultMonth === 'current' || MONTH.test(defaultMonth) ? defaultMonth : 'current',
  };
}

function normalizeCategories(value: unknown): Category[] {
  const seen = new Set<string>();
  const types: CategoryType[] = ['expense', 'savings', 'investment'];
  const out = array(value)
    .filter(isObject)
    .map((raw): Category => {
      const name = str(raw.name).trim();
      return {
        id: uniqueId(seen, raw.id, 'cat'),
        name: name || 'Untitled',
        type: types.includes(raw.type as CategoryType) ? (raw.type as CategoryType) : 'expense',
        // Older files stored an emoji here; it is translated to an icon name.
        icon: resolveIconName(raw.icon, DEFAULT_CATEGORY_ICON),
      };
    });
  // A file with no categories at all cannot record anything — reseed it.
  return out.length > 0 ? out : DEFAULT_CATEGORIES.map((c) => ({ ...c }));
}

function normalizeAccounts(value: unknown): Account[] {
  const seen = new Set<string>();
  const out = array(value)
    .filter(isObject)
    .map((raw): Account => {
      const name = str(raw.name).trim();
      return {
        id: uniqueId(seen, raw.id, 'acc'),
        name: name || 'Untitled',
        icon: resolveIconName(raw.icon, DEFAULT_ACCOUNT_ICON),
        // Opening balances may legitimately be negative (an overdrawn account).
        openingBalance: Number.isFinite(Number(raw.openingBalance))
          ? Math.round(Number(raw.openingBalance) * 100) / 100
          : 0,
      };
    });
  return out.length > 0 ? out : DEFAULT_ACCOUNTS.map((a) => ({ ...a }));
}

function normalizeIncome(value: unknown, accountIds: Set<string>): IncomeEntry[] {
  const seen = new Set<string>();
  const types: IncomeType[] = ['salary', 'bonus', 'freelance', 'other'];
  return array(value)
    .filter(isObject)
    .map((raw): IncomeEntry => {
      const accountId = str(raw.accountId) || null;
      return {
        id: uniqueId(seen, raw.id, 'inc'),
        date: isoDate(raw.date, today()),
        type: types.includes(raw.type as IncomeType) ? (raw.type as IncomeType) : 'other',
        description: str(raw.description).slice(0, 200),
        amount: money(raw.amount),
        accountId: accountId && accountIds.has(accountId) ? accountId : null,
        createdAt: str(raw.createdAt, new Date().toISOString()),
      };
    })
    .filter((entry) => entry.amount > 0);
}

function normalizeTransactions(
  value: unknown,
  categoryIds: Set<string>,
  accountIds: Set<string>,
  debtIds: Set<string>,
): Transaction[] {
  const seen = new Set<string>();
  return array(value)
    .filter(isObject)
    .map((raw): Transaction => {
      const direction: TransactionDirection = raw.direction === 'in' ? 'in' : 'out';
      const categoryId = str(raw.categoryId) || null;
      const accountId = str(raw.accountId) || null;
      const debtId = str(raw.debtId) || null;
      return {
        id: uniqueId(seen, raw.id, 'exp'),
        amount: money(raw.amount),
        // A category that no longer exists is dropped rather than dangling.
        categoryId: categoryId && categoryIds.has(categoryId) ? categoryId : null,
        date: isoDate(raw.date, today()),
        description: str(raw.description).slice(0, 200),
        accountId: accountId && accountIds.has(accountId) ? accountId : null,
        notes: str(raw.notes).slice(0, 2000),
        direction,
        debtId: debtId && debtIds.has(debtId) ? debtId : null,
        createdAt: str(raw.createdAt, new Date().toISOString()),
      };
    })
    // Outgoing money with no surviving category cannot be reported on; drop it.
    .filter((t) => t.amount > 0 && (t.direction === 'in' || t.categoryId !== null));
}

function normalizeBudgets(value: unknown, categoryIds: Set<string>): Budget[] {
  const byMonth = new Map<string, Budget>();
  for (const raw of array(value)) {
    if (!isObject(raw)) continue;
    const month = str(raw.month);
    if (!MONTH.test(month)) continue;

    const categories: Record<string, number> = {};
    if (isObject(raw.categories)) {
      for (const [categoryId, amount] of Object.entries(raw.categories)) {
        if (!categoryIds.has(categoryId)) continue;
        const value = money(amount);
        if (value > 0) categories[categoryId] = value;
      }
    }
    // One budget per month wins — later entries replace earlier duplicates.
    byMonth.set(month, { id: `budget_${month.replace('-', '_')}`, month, categories });
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function normalizeGoals(value: unknown): Goal[] {
  const seen = new Set<string>();
  return array(value)
    .filter(isObject)
    .map((raw): Goal => {
      const contributionIds = new Set<string>();
      const contributions = array(raw.contributions)
        .filter(isObject)
        .map(
          (c): GoalContribution => ({
            id: uniqueId(contributionIds, c.id, 'gc'),
            date: isoDate(c.date, today()),
            amount: money(c.amount),
            note: str(c.note).slice(0, 200),
          }),
        )
        .filter((c) => c.amount > 0);

      return {
        id: uniqueId(seen, raw.id, 'goal'),
        name: str(raw.name).trim().slice(0, 120) || 'Untitled goal',
        targetAmount: money(raw.targetAmount),
        initialAmount: money(raw.initialAmount ?? raw.currentAmount),
        targetDate: optionalIsoDate(raw.targetDate),
        description: str(raw.description).slice(0, 500),
        createdAt: str(raw.createdAt, new Date().toISOString()),
        contributions,
      };
    })
    .filter((goal) => goal.targetAmount > 0);
}

function normalizeDebts(value: unknown): Debt[] {
  const seen = new Set<string>();
  const directions: DebtDirection[] = ['payable', 'receivable'];
  return array(value)
    .filter(isObject)
    .map((raw): Debt => {
      return {
        id: uniqueId(seen, raw.id, 'debt'),
        person: str(raw.person).trim().slice(0, 120) || 'Unknown',
        direction: directions.includes(raw.direction as DebtDirection)
          ? (raw.direction as DebtDirection)
          : 'payable',
        amount: money(raw.amount),
        date: isoDate(raw.date, today()),
        dueDate: optionalIsoDate(raw.dueDate),
        description: str(raw.description).slice(0, 200),
        notes: str(raw.notes).slice(0, 2000),
        createdAt: str(raw.createdAt, new Date().toISOString()),
      };
    })
    .filter((debt) => debt.amount > 0);
}

export function normalizeData(input: unknown): FinanceData {
  if (!isObject(input)) return createEmptyData();

  const categories = normalizeCategories(input.categories);
  const accounts = normalizeAccounts(input.accounts);
  const debts = normalizeDebts(input.debts);

  const categoryIds = new Set(categories.map((c) => c.id));
  const accountIds = new Set(accounts.map((a) => a.id));
  const debtIds = new Set(debts.map((d) => d.id));

  return {
    version: DATA_VERSION,
    settings: normalizeSettings(input.settings),
    categories,
    accounts,
    income: normalizeIncome(input.income, accountIds),
    // `transactions` is accepted as an alias so older exports still import.
    expenses: normalizeTransactions(
      input.expenses ?? input.transactions,
      categoryIds,
      accountIds,
      debtIds,
    ),
    budgets: normalizeBudgets(input.budgets, categoryIds),
    goals: normalizeGoals(input.goals),
    debts,
  };
}
