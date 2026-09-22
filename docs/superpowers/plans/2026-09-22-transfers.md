# Transfers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move money between two of the user's own accounts, tagged with the category it belongs to, from a dedicated Transfers screen.

**Architecture:** A new `Transfer` entity mirrors `Deposit` at every layer (types → normalize → validation → CRUD → API → calculations → page + manager component). Balances and per-category account contents move on both sides; the month's income/expense arithmetic never sees a transfer.

**Tech Stack:** Next.js 15 app router, React 19, TypeScript, MongoDB (single document), node:test.

**Spec:** `docs/superpowers/specs/2026-09-22-transfers-design.md`

## Global Constraints

- Nothing calculated is stored; every figure derives in `lib/finance/calculations.ts`.
- Amounts stored positive; ids `tr_…` via `createId('tr', …)`.
- Note ≤ 200 chars. Dates `YYYY-MM-DD`.
- No emoji anywhere (a test enforces it). Lucide icons only.
- Run `npm test` and `npm run typecheck` before each commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Type, defaults, normalize, validation

**Files:**
- Modify: `lib/types.ts` (after `Deposit`), `lib/data/defaults.ts` (`transfers: []`), `lib/data/normalize.ts`, `lib/validation.ts`
- Test: `tests/validation.test.ts`, `tests/store.test.ts`, `tests/helpers.ts`

**Interfaces:**
- Produces: `Transfer`, `FinanceData.transfers`, `validateTransfer(data, body): Validated<TransferInput>`, `TransferInput = { fromAccountId; toAccountId; amount; categoryId; date; note }`, helper `transfer(partial)` in tests/helpers.

- [ ] **Step 1: Failing validation tests** — append to `tests/validation.test.ts`:

```ts
describe('transfer validation', () => {
  const data = baseData();
  const MOVE = { fromAccountId: 'bank', toAccountId: 'cash', amount: 5_000, categoryId: 'savings', date: '2026-09-22', note: 'Top up' };

  it('accepts a well-formed transfer', () => {
    const result = validateTransfer(data, MOVE);
    assert.ok(result.ok);
    assert.deepEqual(result.value, MOVE);
  });

  it('refuses to move money into the account it came from', () => {
    const result = validateTransfer(data, { ...MOVE, toAccountId: 'bank' });
    assert.equal(result.ok, false);
    assert.match((result as { fieldErrors: Record<string, string> }).fieldErrors.toAccountId, /different/i);
  });

  it('requires both accounts to exist', () => {
    const result = validateTransfer(data, { ...MOVE, fromAccountId: 'ghost', toAccountId: 'nowhere' });
    assert.equal(result.ok, false);
    const errors = (result as { fieldErrors: Record<string, string> }).fieldErrors;
    assert.ok(errors.fromAccountId);
    assert.ok(errors.toAccountId);
  });

  it('treats the category as optional but real when given', () => {
    const blank = validateTransfer(data, { ...MOVE, categoryId: '' });
    assert.ok(blank.ok);
    assert.equal(blank.value.categoryId, null);
    const bad = validateTransfer(data, { ...MOVE, categoryId: 'ghost' });
    assert.equal(bad.ok, false);
  });

  it('rejects an amount of zero or less', () => {
    const result = validateTransfer(data, { ...MOVE, amount: 0 });
    assert.equal(result.ok, false);
  });
});
```
Add `validateTransfer` to the import list.

- [ ] **Step 2: Failing normalize test** — in `tests/store.test.ts` inside `describe('reading')`:

```ts
  it('drops a transfer whose account is gone and forgets an unknown category', async () => {
    await client.db('finance-test').collection('finance').insertOne({
      _id: 'primary' as never, rev: 1, updatedAt: new Date(),
      data: {
        categories: [{ id: 'food', name: 'Food', type: 'expense', icon: 'utensils' }],
        accounts: [{ id: 'bank', name: 'Bank', icon: 'landmark', openingBalance: 0 }, { id: 'cash', name: 'Cash', icon: 'banknote', openingBalance: 0 }],
        transfers: [
          { id: 'ok', fromAccountId: 'bank', toAccountId: 'cash', amount: 100, date: '2026-09-01', categoryId: 'ghost' },
          { id: 'orphan', fromAccountId: 'bank', toAccountId: 'gone', amount: 100, date: '2026-09-01' },
          { id: 'self', fromAccountId: 'bank', toAccountId: 'bank', amount: 100, date: '2026-09-01' },
        ],
      },
    });
    const data = await store.readData();
    assert.deepEqual(data.transfers.map((t) => [t.id, t.categoryId]), [['ok', null]]);
  });
```

- [ ] **Step 3: Run `npm test`** — expect TS errors: `validateTransfer` not exported, `transfers` not on `FinanceData`.

- [ ] **Step 4: Implement**

`lib/types.ts` after `Deposit`:
```ts
/**
 * Money moved from one of your accounts to another. Neither income nor
 * spending: the month's arithmetic cannot see it. It moves a balance and, when
 * a category is given, moves that pot from one account to the other.
 */
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  /** The pot this money belongs to. Optional. */
  categoryId: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  note: string;
  createdAt: string;
}
```
Add `transfers: Transfer[];` to `FinanceData` after `deposits`. Add `transfers: [],` in `lib/data/defaults.ts` next to `deposits: []`.

`lib/data/normalize.ts` — add after `normalizeDeposits`:
```ts
function normalizeTransfers(value: unknown, categoryIds: Set<string>, accountIds: Set<string>): Transfer[] {
  const seen = new Set<string>();
  return array(value)
    .filter(isObject)
    .map((raw): Transfer => {
      const categoryId = str(raw.categoryId);
      return {
        id: uniqueId(seen, raw.id, 'tr'),
        fromAccountId: str(raw.fromAccountId),
        toAccountId: str(raw.toAccountId),
        amount: money(raw.amount),
        categoryId: categoryIds.has(categoryId) ? categoryId : null,
        date: isoDate(raw.date, today()),
        note: str(raw.note).slice(0, 200),
        createdAt: str(raw.createdAt, new Date().toISOString()),
      };
    })
    // A transfer with a missing side, or both sides the same, moves nothing.
    .filter(
      (t) => t.amount > 0 && accountIds.has(t.fromAccountId) && accountIds.has(t.toAccountId) && t.fromAccountId !== t.toAccountId,
    );
}
```
Import `Transfer` type; add `transfers: normalizeTransfers(input.transfers, categoryIds, accountIds),` to the returned object.

`lib/validation.ts` — after `validateDeposit`:
```ts
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
```

`tests/helpers.ts` — add:
```ts
export function transfer(partial: Partial<Transfer> & { amount: number }): Transfer {
  counter += 1;
  return {
    id: partial.id ?? `tr_${counter}`,
    fromAccountId: partial.fromAccountId ?? 'bank',
    toAccountId: partial.toAccountId ?? 'cash',
    amount: partial.amount,
    categoryId: 'categoryId' in partial ? (partial.categoryId ?? null) : 'savings',
    date: partial.date ?? '2026-09-01',
    note: partial.note ?? '',
    createdAt: partial.createdAt ?? '2026-09-01T00:00:00.000Z',
  };
}
```

- [ ] **Step 5: `npm test` and `npm run typecheck` green.** Commit: `feat(transfers): entity, normalize and validation`.

---

### Task 2: Calculations

**Files:**
- Modify: `lib/finance/calculations.ts` (`AccountBalance`, `getAccountBalances`, `getAccountContents`, `AccountEntryKind`, `getAccountActivity`; new `getTransferOverview`)
- Test: `tests/calculations.test.ts`

**Interfaces:**
- Produces: `AccountBalance.transferredIn`, `AccountBalance.transferredOut`; `AccountEntryKind` gains `'transfer'`; `getTransferOverview(data, month): { movedThisMonth: number; movedAllTime: number; count: number }`; `EnrichedTransfer = Transfer & { from: Account | null; to: Account | null; category: Category | null }` and `enrichTransfers(data): EnrichedTransfer[]` (newest first).

- [ ] **Step 1: Failing tests** — new `describe('transfers', …)` in `tests/calculations.test.ts` (import `transfer` from helpers, `getTransferOverview`, `enrichTransfers`):

```ts
describe('transfers', () => {
  it('moves a balance from one account to the other', () => {
    const data = baseData();
    data.accounts[0].openingBalance = 10_000;
    data.transfers.push(transfer({ amount: 4_000 }));
    const [bank, cash] = getAccountBalances(data);
    assert.equal(bank.transferredOut, 4_000);
    assert.equal(bank.currentBalance, 6_000);
    assert.equal(cash.transferredIn, 4_000);
    assert.equal(cash.currentBalance, 4_000);
  });

  it('moves the pot with the money', () => {
    const data = baseData();
    data.deposits.push(deposit({ amount: 20_000, categoryId: 'savings' }));
    data.transfers.push(transfer({ amount: 5_000, categoryId: 'savings' }));
    const [bank, cash] = getAccountContents(data);
    assert.deepEqual(bank.slices.map((s) => [s.category.id, s.amount]), [['savings', 15_000]]);
    assert.deepEqual(cash.slices.map((s) => [s.category.id, s.amount]), [['savings', 5_000]]);
  });

  it('moves the "not set" slice when no category is given', () => {
    const data = baseData();
    data.transfers.push(transfer({ amount: 1_000, categoryId: null }));
    const [bank, cash] = getAccountContents(data);
    assert.equal(bank.slices[0].amount, -1_000);
    assert.equal(cash.slices[0].amount, 1_000);
    assert.equal(bank.slices[0].category.id, cash.slices[0].category.id);
  });

  it('leaves the month untouched', () => {
    const data = baseData();
    data.transfers.push(transfer({ amount: 9_000, date: '2026-09-05' }));
    const summary = getMonthSummary(data, '2026-09');
    assert.equal(summary.income, 0);
    assert.equal(summary.expenses, 0);
    assert.equal(getTotalBalance(data), 0);
  });

  it('shows both legs in account activity', () => {
    const data = baseData();
    data.transfers.push(transfer({ amount: 2_500, note: 'ATM' }));
    const [bank, cash] = getAccountActivity(data);
    assert.deepEqual(bank.entries.map((e) => [e.kind, e.direction, e.title]), [['transfer', 'out', 'Transfer to Cash']]);
    assert.deepEqual(cash.entries.map((e) => [e.kind, e.direction, e.title]), [['transfer', 'in', 'Transfer from Bank']]);
    assert.equal(bank.entries[0].subtitle, 'ATM');
  });

  it('summarises what moved this month and overall, newest first', () => {
    const data = baseData();
    data.transfers.push(transfer({ amount: 1_000, date: '2026-08-15' }), transfer({ amount: 2_000, date: '2026-09-10' }));
    const overview = getTransferOverview(data, '2026-09');
    assert.equal(overview.movedThisMonth, 2_000);
    assert.equal(overview.movedAllTime, 3_000);
    assert.equal(overview.count, 2);
    assert.deepEqual(enrichTransfers(data).map((t) => t.amount), [2_000, 1_000]);
    assert.equal(enrichTransfers(data)[0].from?.name, 'Bank');
  });
});
```
Check `getMonthSummary` field names (`income`, `expenses`) against the `MonthSummary` interface and adjust if they differ. `getTotalBalance` and `getMonthSummary` must be in the import.

- [ ] **Step 2: Run `npm test`** — expect failures on `transferredOut`, `getTransferOverview`, `enrichTransfers`.

- [ ] **Step 3: Implement** in `lib/finance/calculations.ts`:

`AccountBalance`: add `transferredIn: number; transferredOut: number;` (doc: "Moved in from / out to another of your accounts."). Initialise both to 0 in the map; after the deposits loop:
```ts
  for (const entry of data.transfers) {
    const from = balances.get(entry.fromAccountId);
    const to = balances.get(entry.toAccountId);
    if (from) from.transferredOut += entry.amount;
    if (to) to.transferredIn += entry.amount;
  }
```
Round both in the final map; `currentBalance = opening + incomeIn + receivedIn + addedIn + transferredIn − paidOut − transferredOut`.

`getAccountContents`: extract the slice bump into a local `add(accountId, categoryId, delta, count)`; call it for deposits (`+amount, 1`) and for each transfer twice: `add(from, cat, -amount, 1)` and `add(to, cat, +amount, 1)`. Update the doc comment: "Money you added and money you moved between accounts appear here". Keep sort (largest first; "Not set" last).

`AccountEntryKind`: add `'transfer'`. In `getAccountActivity`, after deposits:
```ts
  const accountName = (id: string) => accounts.get(id)?.name ?? 'another account';
  for (const entry of data.transfers) {
    const detail = entry.note || (entry.categoryId ? categoryName(entry.categoryId) : '');
    push(entry.fromAccountId, { id: entry.id, kind: 'transfer', date: entry.date, title: `Transfer to ${accountName(entry.toAccountId)}`, subtitle: detail, amount: round2(entry.amount), direction: 'out', createdAt: entry.createdAt });
    push(entry.toAccountId, { id: entry.id, kind: 'transfer', date: entry.date, title: `Transfer from ${accountName(entry.fromAccountId)}`, subtitle: detail, amount: round2(entry.amount), direction: 'in', createdAt: entry.createdAt });
  }
```
(`const accounts = accountIndex(data);` at the top of the function.)

New section `// Transfers` before `// Goals`:
```ts
export interface EnrichedTransfer extends Transfer {
  from: Account | null;
  to: Account | null;
  category: Category | null;
}

/** Every transfer, newest first, with its accounts and category resolved. */
export function enrichTransfers(data: FinanceData): EnrichedTransfer[] {
  const accounts = accountIndex(data);
  const categories = categoryIndex(data);
  return sortByDateDesc(data.transfers).map((t) => ({
    ...t,
    from: accounts.get(t.fromAccountId) ?? null,
    to: accounts.get(t.toAccountId) ?? null,
    category: (t.categoryId && categories.get(t.categoryId)) || null,
  }));
}

export interface TransferOverview {
  movedThisMonth: number;
  movedAllTime: number;
  count: number;
}

export function getTransferOverview(data: FinanceData, month: string): TransferOverview {
  return {
    movedThisMonth: round2(sum(data.transfers.filter((t) => monthOf(t.date) === month).map((t) => t.amount))),
    movedAllTime: round2(sum(data.transfers.map((t) => t.amount))),
    count: data.transfers.length,
  };
}
```

- [ ] **Step 4: `npm test` + typecheck green.** Fix `components/accounts/AccountsManager.tsx` `KIND_LABELS` (add `transfer: 'Transfer'`) if typecheck demands it. Commit: `feat(transfers): balances, contents and activity`.

---

### Task 3: CRUD, account deletion, API routes

**Files:**
- Create: `lib/data/transfers.ts`, `app/api/transfers/route.ts`, `app/api/transfers/[id]/route.ts`
- Modify: `lib/data/accounts.ts` (`AccountUsage`, `deleteAccount`)
- Test: `tests/transfers.test.ts` (new, Mongo-backed like `tests/deposits.test.ts`)

**Interfaces:**
- Produces: `createTransfer(body): Promise<Transfer>`, `updateTransfer(id, body)`, `deleteTransfer(id)`; `AccountUsage.transfers: number`.

- [ ] **Step 1: Failing tests** — `tests/transfers.test.ts`, copying the hook scaffold from `tests/deposits.test.ts` verbatim (MongoMemoryServer, `MONGODB_DB = 'transfers-test'`, `require` inside `before`), with `transfers = require('../lib/data/transfers')`:

```ts
const MOVE = { fromAccountId: 'bank', toAccountId: 'cash', amount: 5_000, categoryId: 'savings', date: '2026-09-22', note: '' };

async function balanceOf(accountId: string) {
  const data = await store.readData();
  return calculations.getAccountBalances(data).find((b) => b.account.id === accountId)!.currentBalance;
}

describe('moving money between accounts', () => {
  beforeEach(resetDatabase);

  it('records it and moves the balance', async () => {
    const created = await transfers.createTransfer(MOVE);
    assert.match(created.id, /^tr_/);
    assert.equal(await balanceOf('bank'), -5_000);
    assert.equal(await balanceOf('cash'), 5_000);
  });

  it('refuses the same account on both sides', async () => {
    await assert.rejects(() => transfers.createTransfer({ ...MOVE, toAccountId: 'bank' }), (error: unknown) => {
      const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
      assert.match(fieldErrors.toAccountId ?? '', /different/i);
      return true;
    });
  });

  it('edits one without moving its id', async () => {
    const created = await transfers.createTransfer(MOVE);
    const updated = await transfers.updateTransfer(created.id, { ...MOVE, amount: 7_000 });
    assert.equal(updated.id, created.id);
    assert.equal(updated.createdAt, created.createdAt);
    assert.equal(await balanceOf('cash'), 7_000);
  });

  it('puts the money back when deleted', async () => {
    const created = await transfers.createTransfer(MOVE);
    await transfers.deleteTransfer(created.id);
    assert.equal(await balanceOf('bank'), 0);
    assert.equal((await store.readData()).transfers.length, 0);
  });
});

describe('deleting an account that has transfers', () => {
  beforeEach(resetDatabase);

  it('counts them as usage and removes them on unassign', async () => {
    await transfers.createTransfer(MOVE);
    await assert.rejects(() => accounts.deleteAccount('cash'), /entr/i);
    await accounts.deleteAccount('cash', 'unassign');
    assert.equal((await store.readData()).transfers.length, 0);
    assert.equal(await balanceOf('bank'), 0);
  });
});
```

- [ ] **Step 2: Run `npm test`** — expect failure: module `../lib/data/transfers` not found.

- [ ] **Step 3: Implement**

`lib/data/transfers.ts` — copy `lib/data/deposits.ts` structure: `createId('tr', data.transfers.map((t) => t.id))`, `validateTransfer`, messages "That transfer could not be found.". Header comment: "Money moved between two of your own accounts. Lives in its own array for the same reason deposits do: `getMonthSummary` must never see it."

`lib/data/accounts.ts` — `AccountUsage` gains `transfers: number`; usage counts `data.transfers.filter((t) => t.fromAccountId === id || t.toAccountId === id).length`; include in `total`; under `unassign`: `data.transfers = data.transfers.filter((t) => t.fromAccountId !== id && t.toAccountId !== id);`. Update the doc comment: transfers go with the account too.

`app/api/transfers/route.ts` and `[id]/route.ts` — copy the deposits routes, renaming `deposit → transfer`.

- [ ] **Step 4: `npm test` + typecheck green.** Commit: `feat(transfers): storage and API`.

---

### Task 4: Screen

**Files:**
- Create: `app/(app)/transfers/page.tsx`, `components/transfers/TransfersManager.tsx`
- Modify: `components/layout/navigation.ts`, `components/accounts/AccountsManager.tsx` (`KIND_LABELS`, delete dialog), `app/(app)/accounts/page.tsx` (stat hints)

**Interfaces:**
- Consumes: `enrichTransfers`, `getTransferOverview`, `useAppData().accounts/categories`, `apiRequest`, `Modal`, `ConfirmDialog`, `TextField`, `SelectField`, `FormError`, `EmptyState`, `Button`, `PageHeader`, `StatStrip/StatItem`, `formatCurrency`, `formatDate`, `todayIso`, `currentMonth` from `lib/finance/dates` (check exact name by grepping `export function` in `lib/finance/dates.ts`; `lib/server/month.ts` may have a resolver — use whatever the Dashboard page uses for "this month").

- [ ] **Step 1: Navigation** — in `PRIMARY_NAV` insert `{ href: '/transfers', label: 'Transfers', icon: ArrowRightLeft }` after Accounts (`ArrowRightLeft` from lucide; `ArrowLeftRight` is already taken by Budget).

- [ ] **Step 2: Page** — `app/(app)/transfers/page.tsx`:

```tsx
import { ArrowRightLeft, CalendarDays, Hash } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { enrichTransfers, getTransferOverview } from '@/lib/finance/calculations';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { TransfersManager } from '@/components/transfers/TransfersManager';

export const dynamic = 'force-dynamic';

export default async function TransfersPage() {
  const data = await readData();
  const symbol = data.settings.currencySymbol;
  const month = /* same resolver the dashboard uses */;
  const overview = getTransferOverview(data, month);

  return (
    <>
      <PageHeader title="Transfers" subtitle="Money moved between your accounts" />
      <StatStrip className="mb-4">
        <StatItem label="Moved this month" amount={overview.movedThisMonth} symbol={symbol} icon={CalendarDays} />
        <StatItem label="Moved all time" amount={overview.movedAllTime} symbol={symbol} icon={ArrowRightLeft} />
        <StatItem label="Transfers" icon={Hash}>{overview.count}</StatItem>
      </StatStrip>
      <TransfersManager transfers={enrichTransfers(data)} symbol={symbol} dateFormat={data.settings.dateFormat} />
    </>
  );
}
```
Check `StatItem`'s props in `components/ui/StatCard.tsx` (the Goals page uses the children form for a count).

- [ ] **Step 3: Manager** — `components/transfers/TransfersManager.tsx`, modelled on `GoalsManager`: state `editing: { id?: string; values: TransferValues } | null`, `deleting: EnrichedTransfer | null`, `saving`, `formError`, `fieldErrors`. `TransferValues = { amount: string; date: string; fromAccountId: string; toAccountId: string; categoryId: string; note: string }`. Header row with **New transfer** (`Plus` icon). Empty state: icon `ArrowRightLeft`, title "No transfers yet", body "Move money between your accounts — bank to cash, or into a savings account — and say which pot it belongs to." Desktop table columns: Date · From → To (render `from?.name ?? '—'`, an `ArrowRight` icon, `to?.name ?? '—'`) · Category (`category?.name ?? 'Not set'`) · Note · Amount (right, `tnum`) · Edit/Delete icon buttons. Mobile: `<ul className="md:hidden">` with title `From → To`, meta line `date · category`, amount right. Save via `apiRequest` to `/api/transfers` or `/api/transfers/${id}` with body `{ ...values, categoryId: values.categoryId || null }`; toast `Moved ${formatCurrency(amount)} to ${to.name}.` / `Transfer updated.`; `router.refresh()`. Delete via `ConfirmDialog` body "Both accounts go back to what they were before this transfer." Modal form: Amount + Date (2-col), From account (`SelectField`, required), To account (required), Category (`SelectField`, optional; options grouped: "Set aside" for `type !== 'expense'`, "Spending" for `expense`, "Not set" default), Note (`TextField`, maxLength 200). Form id `transfer-form`; submit button in modal footer.

- [ ] **Step 4: Accounts page touches** — `KIND_LABELS` add `transfer: 'Transfer'` (if not done in Task 2). Delete dialog: add a clause "…and {n} transfer{s}, which are removed with it" using a `transfersIn(accountId)` count — pass `transfers={data.transfers}` from `app/(app)/accounts/page.tsx` into `AccountsManager` (new prop `transfers: Transfer[]`). Stat hints on the accounts page: "Money in" hint → "Income, repayments, money added and transfers in"; "Money out" hint → "Paid or transferred out"; include `transferredIn` / `transferredOut` in those two sums.

- [ ] **Step 5: Verify** — `npm run typecheck`, `npm test`, then `npm run dev` and load `/transfers`: empty state renders; open **New transfer**, confirm both account selects populate; cancel. Load `/accounts` to confirm it renders. Commit: `feat(transfers): screen and navigation`.

---

### Task 5: README

**Files:**
- Modify: `README.md` — after the *Accounts* section's "Deleting an account…" paragraph.

- [ ] **Step 1: Write**

```markdown
### Transfers

A transfer moves money from one of your accounts to another. It is neither income
nor spending — the month's arithmetic cannot see it — so the total across accounts
does not change; only where the money sits does.

Give it a category and the pot moves too: 5,000 of *Emergency* transferred from
JS Bank to Cash takes 5,000 off JS Bank's Emergency slice and adds it to Cash's.
Move a pot out of an account that never had it recorded and that slice goes
negative rather than pretending otherwise.

Each account's history shows both legs — *Transfer to Cash* on one side,
*Transfer from JS Bank* on the other. Deleting an account removes its transfers on
both sides, as with money added: a transfer with a missing end records nothing.
```
Also add `Transfers` to the page list in the *Project layout* block (`Dashboard, Income, Expenses, Subscriptions, Budget, Analytics, Goals, Accounts, Transfers, Debts`).

- [ ] **Step 2: Commit** `docs: transfers`.

---

## Self-review

- Spec coverage: entity/normalize/validation (T1); balances, contents, activity, overview (T2); CRUD, account delete, API (T3); nav, page, manager, accounts-page touches (T4); README (T5). Category deletion needs no code — normalize clears on read (T1 test covers it). ✔
- Placeholders: T4 Step 2 says "same resolver the dashboard uses" — executor must grep `app/(app)/dashboard/page.tsx` for how the month is resolved and copy it. Everything else is concrete.
- Names consistent: `transferredIn/Out`, `enrichTransfers`, `getTransferOverview`, `validateTransfer`, `createTransfer/updateTransfer/deleteTransfer`, `AccountUsage.transfers`, kind `'transfer'`.
