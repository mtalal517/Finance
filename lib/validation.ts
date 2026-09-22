import { isValidDate, isValidMonth, todayIso } from './finance/dates';
import { DEFAULT_ACCOUNT_ICON, DEFAULT_CATEGORY_ICON, resolveIconName } from './icons/names';
import type {
  BillingCycle,
  CategoryType,
  DateFormat,
  DebtDirection,
  FinanceData,
  IncomeType,
  TransactionDirection,
} from '@/lib/types';

/**
 * Server-side validation for every mutation.
 *
 * The client never gets to decide what is valid, and it never sends a computed
 * total — only raw fields, which are checked here against the current data
 * (does this category exist? does this account exist?) before anything is
 * written. Errors come back keyed by field so the form can highlight them.
 *
 * Framework-free on purpose, so the test suite can call it directly.
 */

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

class Validator {
  readonly fieldErrors: Record<string, string> = {};

  fail(field: string, message: string): void {
    if (!this.fieldErrors[field]) this.fieldErrors[field] = message;
  }

  get hasErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }

  result<T>(value: T, message = 'Please correct the highlighted fields.'): Validated<T> {
    if (this.hasErrors) return { ok: false, message, fieldErrors: this.fieldErrors };
    return { ok: true, value };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Accepts numbers and numeric strings, since form fields arrive as strings. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const MAX_AMOUNT = 1_000_000_000_000;

function amount(
  v: Validator,
  raw: unknown,
  field: string,
  label: string,
  { allowZero = false } = {},
): number {
  const n = toNumber(raw);
  if (n === null) {
    v.fail(field, `${label} is required.`);
    return 0;
  }
  if (!allowZero && n <= 0) {
    v.fail(field, `${label} must be greater than 0.`);
    return 0;
  }
  if (n < 0) {
    v.fail(field, `${label} cannot be negative.`);
    return 0;
  }
  if (n > MAX_AMOUNT) {
    v.fail(field, `${label} is unrealistically large.`);
    return 0;
  }
  return round2(n);
}

function date(v: Validator, raw: unknown, field = 'date', label = 'Date'): string {
  const value = text(raw);
  if (!value) {
    v.fail(field, `${label} is required.`);
    return todayIso();
  }
  if (!isValidDate(value)) {
    v.fail(field, `${label} must be a real date.`);
    return todayIso();
  }
  return value;
}

function optionalDate(v: Validator, raw: unknown, field: string, label: string): string | null {
  const value = text(raw);
  if (!value) return null;
  if (!isValidDate(value)) {
    v.fail(field, `${label} must be a real date.`);
    return null;
  }
  return value;
}

function requiredText(v: Validator, raw: unknown, field: string, label: string, max = 120): string {
  const value = text(raw);
  if (!value) {
    v.fail(field, `${label} is required.`);
    return '';
  }
  if (value.length > max) {
    v.fail(field, `${label} must be ${max} characters or fewer.`);
    return value.slice(0, max);
  }
  return value;
}

function optionalText(raw: unknown, max: number): string {
  return text(raw).slice(0, max);
}

function categoryRef(
  v: Validator,
  data: FinanceData,
  raw: unknown,
  field = 'categoryId',
  { required = true } = {},
): string | null {
  const id = text(raw);
  if (!id) {
    if (required) v.fail(field, 'Category is required.');
    return null;
  }
  if (!data.categories.some((c) => c.id === id)) {
    v.fail(field, 'That category no longer exists.');
    return null;
  }
  return id;
}

/** Accounts are optional everywhere, but a named account must actually exist. */
function accountRef(
  v: Validator,
  data: FinanceData,
  raw: unknown,
  field = 'accountId',
  { required = false } = {},
): string | null {
  const id = text(raw);
  if (!id) {
    if (required) v.fail(field, 'Account is required.');
    return null;
  }
  if (!data.accounts.some((a) => a.id === id)) {
    v.fail(field, 'That account no longer exists.');
    return null;
  }
  return id;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface TransactionInput {
  amount: number;
  categoryId: string | null;
  date: string;
  description: string;
  accountId: string | null;
  notes: string;
  direction: TransactionDirection;
  debtId: string | null;
  goalId: string | null;
}

export function validateTransaction(data: FinanceData, body: unknown): Validated<TransactionInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const direction: TransactionDirection = body.direction === 'in' ? 'in' : 'out';
  const debtIdRaw = text(body.debtId);
  let debtId: string | null = null;
  if (debtIdRaw) {
    if (!data.debts.some((d) => d.id === debtIdRaw)) v.fail('debtId', 'That debt no longer exists.');
    else debtId = debtIdRaw;
  }
  const goalIdRaw = text(body.goalId);
  let goalId: string | null = null;
  if (goalIdRaw) {
    if (!data.goals.some((g) => g.id === goalIdRaw)) v.fail('goalId', 'That goal no longer exists.');
    else goalId = goalIdRaw;
  }

  return v.result<TransactionInput>({
    amount: amount(v, body.amount, 'amount', 'Amount'),
    // Money coming back in from a loan you made has no budget category.
    categoryId: categoryRef(v, data, body.categoryId, 'categoryId', { required: direction === 'out' }),
    date: date(v, body.date),
    description: optionalText(body.description, 200),
    accountId: accountRef(v, data, body.accountId),
    notes: optionalText(body.notes, 2000),
    direction,
    debtId,
    goalId,
  });
}

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------

export interface IncomeInput {
  amount: number;
  date: string;
  type: IncomeType;
  description: string;
  accountId: string | null;
}

const INCOME_TYPES: IncomeType[] = ['salary', 'bonus', 'freelance', 'other'];

export function validateIncome(data: FinanceData, body: unknown): Validated<IncomeInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const type = text(body.type) as IncomeType;
  if (!INCOME_TYPES.includes(type)) v.fail('type', 'Choose an income type.');

  return v.result<IncomeInput>({
    amount: amount(v, body.amount, 'amount', 'Amount'),
    date: date(v, body.date),
    type: INCOME_TYPES.includes(type) ? type : 'other',
    description: optionalText(body.description, 200),
    accountId: accountRef(v, data, body.accountId),
  });
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export interface BudgetInput {
  month: string;
  categories: Record<string, number>;
}

export function validateBudget(data: FinanceData, body: unknown): Validated<BudgetInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const month = text(body.month);
  if (!isValidMonth(month)) v.fail('month', 'Choose a valid month.');

  const categories: Record<string, number> = {};
  if (!isObject(body.categories)) {
    v.fail('categories', 'Budget allocations are missing.');
  } else {
    for (const [categoryId, raw] of Object.entries(body.categories)) {
      if (!data.categories.some((c) => c.id === categoryId)) {
        v.fail(`categories.${categoryId}`, 'That category no longer exists.');
        continue;
      }
      const value = toNumber(raw);
      if (value === null) continue; // A cleared field means "no allocation".
      if (value < 0) {
        v.fail(`categories.${categoryId}`, 'A budget cannot be negative.');
        continue;
      }
      if (value > MAX_AMOUNT) {
        v.fail(`categories.${categoryId}`, 'That budget is unrealistically large.');
        continue;
      }
      if (value > 0) categories[categoryId] = round2(value);
    }
  }

  return v.result<BudgetInput>({ month, categories });
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface GoalInput {
  name: string;
  targetAmount: number;
  initialAmount: number;
  targetDate: string | null;
  description: string;
}

export function validateGoal(body: unknown): Validated<GoalInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const targetAmount = amount(v, body.targetAmount, 'targetAmount', 'Target amount');
  const initialAmount = amount(v, body.initialAmount ?? 0, 'initialAmount', 'Current amount', {
    allowZero: true,
  });
  if (targetAmount > 0 && initialAmount > targetAmount) {
    v.fail('initialAmount', 'The starting amount cannot exceed the target.');
  }

  return v.result<GoalInput>({
    name: requiredText(v, body.name, 'name', 'Goal name'),
    targetAmount,
    initialAmount,
    targetDate: optionalDate(v, body.targetDate, 'targetDate', 'Target date'),
    description: optionalText(body.description, 500),
  });
}

export interface ContributionInput {
  amount: number;
  date: string;
  note: string;
}

export function validateContribution(body: unknown): Validated<ContributionInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }
  return v.result<ContributionInput>({
    amount: amount(v, body.amount, 'amount', 'Amount'),
    date: date(v, body.date),
    note: optionalText(body.note, 200),
  });
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export interface DebtInput {
  person: string;
  direction: DebtDirection;
  amount: number;
  date: string;
  dueDate: string | null;
  description: string;
  notes: string;
}

export function validateDebt(body: unknown): Validated<DebtInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const direction = text(body.direction) as DebtDirection;
  if (direction !== 'payable' && direction !== 'receivable') {
    v.fail('direction', 'Choose whether you owe this or are owed it.');
  }

  const debtDate = date(v, body.date);
  const dueDate = optionalDate(v, body.dueDate, 'dueDate', 'Due date');
  if (dueDate && dueDate < debtDate) {
    v.fail('dueDate', 'The due date cannot be before the date the debt started.');
  }

  return v.result<DebtInput>({
    person: requiredText(v, body.person, 'person', 'Person or lender'),
    direction: direction === 'receivable' ? 'receivable' : 'payable',
    amount: amount(v, body.amount, 'amount', 'Amount'),
    date: debtDate,
    dueDate,
    description: optionalText(body.description, 200),
    notes: optionalText(body.notes, 2000),
  });
}

// ---------------------------------------------------------------------------
// Money added to an account
// ---------------------------------------------------------------------------

export interface DepositInput {
  accountId: string;
  amount: number;
  categoryId: string | null;
  date: string;
  note: string;
}

/**
 * The account is required — money has to sit somewhere for the entry to record
 * anything. What the money is for is optional: often you only know that it
 * arrived. A category that *is* named still has to exist.
 */
export function validateDeposit(data: FinanceData, body: unknown): Validated<DepositInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  return v.result<DepositInput>({
    accountId: accountRef(v, data, body.accountId, 'accountId', { required: true }) ?? '',
    amount: amount(v, body.amount, 'amount', 'Amount'),
    categoryId: categoryRef(v, data, body.categoryId, 'categoryId', { required: false }),
    date: date(v, body.date),
    note: optionalText(body.note, 200),
  });
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  categoryId: string | null;
  date: string;
  note: string;
}

export function validateTransfer(data: FinanceData, body: unknown): Validated<TransferInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const fromAccountId = accountRef(v, data, body.fromAccountId, 'fromAccountId', { required: true }) ?? '';
  const toAccountId = accountRef(v, data, body.toAccountId, 'toAccountId', { required: true }) ?? '';
  if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
    v.fail('toAccountId', 'Choose a different account to move the money into.');
  }

  return v.result<TransferInput>({
    fromAccountId,
    toAccountId,
    amount: amount(v, body.amount, 'amount', 'Amount'),
    categoryId: categoryRef(v, data, body.categoryId, 'categoryId', { required: false }),
    date: date(v, body.date),
    note: optionalText(body.note, 200),
  });
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export interface SubscriptionInput {
  name: string;
  amount: number;
  cycle: BillingCycle;
  nextDueDate: string;
  categoryId: string | null;
  accountId: string | null;
  icon: string;
  active: boolean;
  notes: string;
}

const BILLING_CYCLES: BillingCycle[] = ['monthly', 'quarterly', 'yearly'];

/**
 * The category is required: paying a subscription writes an ordinary outgoing
 * transaction, and an outgoing transaction with no category cannot be reported
 * on. Better to insist here than to write a row the budget cannot see.
 */
export function validateSubscription(
  data: FinanceData,
  body: unknown,
): Validated<SubscriptionInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const cycle = text(body.cycle) as BillingCycle;
  if (!BILLING_CYCLES.includes(cycle)) v.fail('cycle', 'Choose how often it is charged.');

  return v.result<SubscriptionInput>({
    name: requiredText(v, body.name, 'name', 'Name'),
    amount: amount(v, body.amount, 'amount', 'Amount'),
    cycle: BILLING_CYCLES.includes(cycle) ? cycle : 'monthly',
    nextDueDate: date(v, body.nextDueDate, 'nextDueDate', 'Next due date'),
    categoryId: categoryRef(v, data, body.categoryId),
    accountId: accountRef(v, data, body.accountId),
    icon: resolveIconName(body.icon, 'repeat'),
    // Absent means running; only an explicit `false` pauses it.
    active: body.active !== false,
    notes: optionalText(body.notes, 2000),
  });
}

/**
 * A repayment. On a debt you owe, the allocation (category) says which budget
 * the money comes out of and is required — that is the whole point of the
 * feature. On money owed to you, there is no budget to charge.
 */
export interface DebtPaymentInput {
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  note: string;
}

export function validateDebtPayment(
  data: FinanceData,
  direction: DebtDirection,
  body: unknown,
): Validated<DebtPaymentInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  return v.result<DebtPaymentInput>({
    amount: amount(v, body.amount, 'amount', 'Amount'),
    date: date(v, body.date),
    categoryId:
      direction === 'payable'
        ? categoryRef(v, data, body.categoryId, 'categoryId', { required: true })
        : null,
    accountId: accountRef(v, data, body.accountId),
    note: optionalText(body.note, 200),
  });
}

// ---------------------------------------------------------------------------
// Accounts & categories
// ---------------------------------------------------------------------------

export interface AccountInput {
  name: string;
  icon: string;
  openingBalance: number;
}

export function validateAccount(body: unknown): Validated<AccountInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  // Opening balances may be negative — an overdrawn account is a real thing.
  const raw = toNumber(body.openingBalance ?? 0);
  if (raw === null) v.fail('openingBalance', 'Opening balance must be a number.');
  else if (Math.abs(raw) > MAX_AMOUNT) v.fail('openingBalance', 'That balance is unrealistically large.');

  return v.result<AccountInput>({
    name: requiredText(v, body.name, 'name', 'Account name', 60),
    icon: resolveIconName(body.icon, DEFAULT_ACCOUNT_ICON),
    openingBalance: raw === null ? 0 : round2(raw),
  });
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  icon: string;
}

const CATEGORY_TYPES: CategoryType[] = ['expense', 'savings', 'investment'];

export function validateCategory(body: unknown): Validated<CategoryInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const type = text(body.type) as CategoryType;
  if (!CATEGORY_TYPES.includes(type)) v.fail('type', 'Choose a category type.');

  return v.result<CategoryInput>({
    name: requiredText(v, body.name, 'name', 'Category name', 60),
    type: CATEGORY_TYPES.includes(type) ? type : 'expense',
    icon: resolveIconName(body.icon, DEFAULT_CATEGORY_ICON),
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SettingsInput {
  currency: string;
  currencySymbol: string;
  dateFormat: DateFormat;
  defaultMonth: string;
}

const DATE_FORMATS: DateFormat[] = ['dd MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];

export function validateSettings(body: unknown): Validated<SettingsInput> {
  const v = new Validator();
  if (!isObject(body)) {
    return { ok: false, message: 'The request was not understood.', fieldErrors: {} };
  }

  const dateFormat = text(body.dateFormat) as DateFormat;
  if (!DATE_FORMATS.includes(dateFormat)) v.fail('dateFormat', 'Choose a date format.');

  const defaultMonth = text(body.defaultMonth) || 'current';
  if (defaultMonth !== 'current' && !isValidMonth(defaultMonth)) {
    v.fail('defaultMonth', 'Choose a valid month.');
  }

  return v.result<SettingsInput>({
    currency: requiredText(v, body.currency, 'currency', 'Currency code', 8),
    currencySymbol: requiredText(v, body.currencySymbol, 'currencySymbol', 'Currency symbol', 8),
    dateFormat: DATE_FORMATS.includes(dateFormat) ? dateFormat : 'dd MMM yyyy',
    defaultMonth,
  });
}
