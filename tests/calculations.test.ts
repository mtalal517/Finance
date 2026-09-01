import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAccountBalances,
  getBudgetVsActual,
  getCategoryDetail,
  getDebtOverview,
  getGoalProgress,
  getMonthSummary,
  getSpendingComparison,
  getYearSummary,
} from '../lib/finance/calculations';
import { baseData, income, txn } from './helpers';

const SEP = '2026-09';

describe('month summary', () => {
  it('treats an allocation to a savings category as the act of saving', () => {
    const data = baseData();
    data.income.push(income(110_000, '2026-09-01'));
    data.budgets.push({
      id: 'budget_2026_09',
      month: SEP,
      categories: { transport: 5_000, food: 10_000, savings: 20_000, investment: 20_000 },
    });
    data.expenses.push(
      txn({ amount: 4_300, date: '2026-09-02', categoryId: 'transport' }),
      txn({ amount: 8_050, date: '2026-09-05', categoryId: 'food' }),
    );

    const summary = getMonthSummary(data, SEP);

    assert.equal(summary.income, 110_000);
    assert.equal(summary.expenses, 12_350);
    assert.equal(summary.savings, 20_000, 'budgeted to a savings category, so it is set aside');
    assert.equal(summary.investments, 20_000);
    assert.equal(summary.outflow, 52_350, 'spent plus committed');
    assert.equal(summary.remaining, 57_650, 'income neither spent nor committed');
  });

  it('draws a pot down when money is spent against it, and still counts the spending', () => {
    const data = baseData();
    data.income.push(income(110_000, '2026-09-01'));
    data.budgets.push({
      id: 'budget_2026_09',
      month: SEP,
      categories: { food: 10_000, savings: 20_000 },
    });
    data.expenses.push(
      txn({ amount: 8_050, date: '2026-09-05', categoryId: 'food' }),
      txn({ amount: 3_000, date: '2026-09-07', categoryId: 'savings' }),
    );

    const summary = getMonthSummary(data, SEP);

    assert.equal(summary.savings, 17_000, 'the pot is drawn down by what was taken out of it');
    assert.equal(summary.expenses, 11_050, 'the money left an account, so it is spending too');
    assert.equal(summary.outflow, 28_050);
    assert.equal(summary.remaining, 81_950);
  });

  it('caps a pot at zero and lets the excess stand as plain spending', () => {
    const data = baseData();
    data.income.push(income(110_000, '2026-09-01'));
    data.budgets.push({ id: 'budget_2026_09', month: SEP, categories: { savings: 5_000 } });
    data.expenses.push(txn({ amount: 8_000, date: '2026-09-07', categoryId: 'savings' }));

    const summary = getMonthSummary(data, SEP);

    assert.equal(summary.savings, 0, 'you cannot have less than nothing set aside');
    assert.equal(summary.expenses, 8_000);
    assert.equal(summary.remaining, 102_000, 'the 3,000 drawn past the pot comes out of income');
  });

  it('sets nothing aside for a savings category with no allocation', () => {
    const data = baseData();
    data.income.push(income(110_000, '2026-09-01'));
    data.expenses.push(txn({ amount: 20_000, date: '2026-09-05', categoryId: 'savings' }));

    const summary = getMonthSummary(data, SEP);

    assert.equal(summary.savings, 0, 'the budget is what sets money aside, not the transaction');
    assert.equal(summary.expenses, 20_000);
  });

  it('ignores transactions from other months', () => {
    const data = baseData();
    data.expenses.push(
      txn({ amount: 1_000, date: '2026-08-31' }),
      txn({ amount: 500, date: '2026-09-01' }),
      txn({ amount: 900, date: '2026-10-01' }),
    );
    assert.equal(getMonthSummary(data, SEP).expenses, 500);
  });

  it('does not count a repayment received as income or as spending', () => {
    const data = baseData();
    data.income.push(income(100_000, '2026-09-01'));
    data.expenses.push(txn({ amount: 5_000, date: '2026-09-10', direction: 'in', categoryId: null }));

    const summary = getMonthSummary(data, SEP);
    assert.equal(summary.income, 100_000);
    assert.equal(summary.expenses, 0);
    assert.equal(summary.outflow, 0);
  });

  it('reports a negative remaining when spending exceeds income', () => {
    const data = baseData();
    data.income.push(income(10_000, '2026-09-01'));
    data.expenses.push(txn({ amount: 12_000, date: '2026-09-04' }));
    assert.equal(getMonthSummary(data, SEP).remaining, -2_000);
  });
});

describe('budget vs actual', () => {
  it('derives spent and remaining from transactions, and flags status', () => {
    const data = baseData();
    data.income.push(income(110_000, '2026-09-01'));
    data.budgets.push({
      id: 'budget_2026_09',
      month: SEP,
      categories: { transport: 15_000, food: 10_000, family: 11_000, home: 5_000 },
    });
    data.expenses.push(
      txn({ amount: 4_300, date: '2026-09-02', categoryId: 'transport' }),
      txn({ amount: 7_250, date: '2026-09-03', categoryId: 'food' }),
      txn({ amount: 8_000, date: '2026-09-04', categoryId: 'family' }),
      txn({ amount: 6_000, date: '2026-09-05', categoryId: 'home' }),
    );

    const overview = getBudgetVsActual(data, SEP);
    const row = (id: string) => overview.rows.find((r) => r.category.id === id)!;

    assert.equal(row('transport').spent, 4_300);
    assert.equal(row('transport').remaining, 10_700);
    assert.equal(Number(row('transport').percentUsed.toFixed(1)), 28.7);
    assert.equal(row('transport').status, 'good');

    assert.equal(row('food').status, 'warning', '72.5% used is a warning');
    assert.equal(row('family').status, 'warning');

    assert.equal(row('home').status, 'over');
    assert.equal(row('home').remaining, -1_000, 'overspending shows as a negative remainder');

    assert.equal(overview.totalAllocated, 41_000);
    assert.equal(overview.unallocated, 69_000);
  });

  it('lists a spent category that has no allocation', () => {
    const data = baseData();
    data.expenses.push(txn({ amount: 900, date: '2026-09-08', categoryId: 'medical' }));

    const overview = getBudgetVsActual(data, SEP);
    const row = overview.rows.find((r) => r.category.id === 'medical')!;
    assert.equal(row.status, 'unbudgeted');
    assert.equal(row.budget, 0);
    assert.equal(row.spent, 900);
  });

  it('separates set-aside allocations from spending, and totals them by type', () => {
    const data = baseData();
    data.budgets.push({
      id: 'budget_2026_09',
      month: SEP,
      categories: { transport: 15_000, savings: 20_000, investment: 10_000 },
    });
    data.expenses.push(txn({ amount: 4_300, date: '2026-09-02', categoryId: 'transport' }));

    const overview = getBudgetVsActual(data, SEP);

    assert.deepEqual(overview.expenseRows.map((r) => r.category.id), ['transport']);
    assert.deepEqual(overview.setAsideRows.map((r) => r.category.id), ['savings', 'investment']);
    assert.equal(overview.allocatedSavings, 20_000);
    assert.equal(overview.allocatedInvestments, 10_000);
  });

  it('keeps a set-aside allocation visible when nothing has been moved into it', () => {
    const data = baseData();
    data.budgets.push({ id: 'budget_2026_09', month: SEP, categories: { savings: 20_000 } });

    const overview = getBudgetVsActual(data, SEP);
    const row = overview.setAsideRows.find((r) => r.category.id === 'savings')!;

    assert.equal(row.budget, 20_000);
    assert.equal(row.spent, 0);
    assert.equal(overview.allocatedSavings, 20_000);
    assert.equal(
      getMonthSummary(data, SEP).savings,
      20_000,
      'the allocation is the saving, with nothing drawn back out of it',
    );
  });

  it('does not invent rows for untouched categories', () => {
    const data = baseData();
    data.expenses.push(txn({ amount: 100, date: '2026-09-08', categoryId: 'food' }));
    const overview = getBudgetVsActual(data, SEP);
    assert.equal(overview.rows.length, 1);
  });
});

describe('category detail', () => {
  it('answers what was spent, when, and how it compares', () => {
    const data = baseData();
    data.budgets.push({ id: 'budget_2026_09', month: SEP, categories: { transport: 15_000 } });
    data.expenses.push(
      txn({ amount: 700, date: '2026-09-02', description: 'Office transport' }),
      txn({ amount: 700, date: '2026-09-04', description: 'Office transport' }),
      txn({ amount: 500, date: '2026-09-07', description: 'Fuel' }),
      txn({ amount: 700, date: '2026-09-10', description: 'Office transport' }),
      txn({ amount: 1_000, date: '2026-09-15', description: 'Fuel' }),
      txn({ amount: 700, date: '2026-09-22', description: 'Office transport' }),
      txn({ amount: 3_000, date: '2026-08-11', description: 'Last month' }),
    );

    const detail = getCategoryDetail(data, SEP, 'transport')!;

    assert.equal(detail.spent, 4_300);
    assert.equal(detail.remaining, 10_700);
    assert.equal(detail.transactionCount, 6);
    assert.equal(detail.averageTransaction, 716.67);
    assert.equal(detail.largest?.amount, 1_000);
    assert.equal(detail.previousMonthSpent, 3_000);
    assert.deepEqual(
      detail.transactions.map((t) => t.date),
      ['2026-09-02', '2026-09-04', '2026-09-07', '2026-09-10', '2026-09-15', '2026-09-22'],
      'transactions come back in date order',
    );
  });

  it('returns null for a category that does not exist', () => {
    assert.equal(getCategoryDetail(baseData(), SEP, 'nope'), null);
  });

  it('handles a category with no spending without dividing by zero', () => {
    const detail = getCategoryDetail(baseData(), SEP, 'transport')!;
    assert.equal(detail.spent, 0);
    assert.equal(detail.averageTransaction, 0);
    assert.equal(detail.percentUsed, 0);
  });
});

describe('account balances', () => {
  it('is opening plus income in, plus repayments in, minus everything out', () => {
    const data = baseData();
    data.accounts = [{ id: 'bank', name: 'Bank', icon: '🏦', openingBalance: 50_000 }];
    data.income.push(income(110_000, '2026-09-01', { accountId: 'bank' }));
    data.expenses.push(
      txn({ amount: 12_000, date: '2026-09-05', accountId: 'bank' }),
      txn({ amount: 3_000, date: '2026-09-06', accountId: 'bank', direction: 'in', categoryId: null }),
      txn({ amount: 999, date: '2026-09-07', accountId: null }),
    );

    const [balance] = getAccountBalances(data);
    assert.equal(balance.incomeIn, 110_000);
    assert.equal(balance.paidOut, 12_000);
    assert.equal(balance.receivedIn, 3_000);
    assert.equal(balance.currentBalance, 151_000);
  });
});

describe('goals', () => {
  it('adds contributions to the starting amount', () => {
    const progress = getGoalProgress({
      id: 'g1',
      name: 'Emergency fund',
      targetAmount: 300_000,
      initialAmount: 100_000,
      targetDate: null,
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      contributions: [
        { id: 'c1', date: '2026-08-01', amount: 10_000, note: '' },
        { id: 'c2', date: '2026-09-01', amount: 10_000, note: '' },
      ],
    });

    assert.equal(progress.currentAmount, 120_000);
    assert.equal(progress.remaining, 180_000);
    assert.equal(progress.percentComplete, 40);
    assert.equal(progress.isComplete, false);
  });

  it('caps a passed goal at 100% and never reports a negative remainder', () => {
    const progress = getGoalProgress({
      id: 'g2',
      name: 'Laptop',
      targetAmount: 100_000,
      initialAmount: 120_000,
      targetDate: null,
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      contributions: [],
    });
    assert.equal(progress.percentComplete, 100);
    assert.equal(progress.remaining, 0);
    assert.equal(progress.isComplete, true);
  });
});

describe('debts', () => {
  it('derives what is outstanding from the linked repayments', () => {
    const data = baseData();
    data.debts.push({
      id: 'debt_1',
      person: 'Ahmed',
      direction: 'payable',
      amount: 25_000,
      date: '2026-08-01',
      dueDate: '2099-01-01',
      description: '',
      notes: '',
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    data.expenses.push(
      txn({ amount: 5_000, date: '2026-09-14', categoryId: 'family', debtId: 'debt_1' }),
      txn({ amount: 2_000, date: '2026-09-20', categoryId: 'family', debtId: 'debt_1' }),
    );

    const overview = getDebtOverview(data);
    const [debt] = overview.payable;

    assert.equal(debt.paid, 7_000);
    assert.equal(debt.outstanding, 18_000);
    assert.equal(debt.status, 'partial');
    assert.equal(overview.totalOwed, 18_000);
  });

  it('counts a repayment against the budget category it was paid from', () => {
    const data = baseData();
    data.budgets.push({ id: 'budget_2026_09', month: SEP, categories: { family: 11_000 } });
    data.debts.push({
      id: 'debt_1',
      person: 'Ahmed',
      direction: 'payable',
      amount: 25_000,
      date: '2026-08-01',
      dueDate: null,
      description: '',
      notes: '',
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    data.expenses.push(txn({ amount: 5_000, date: '2026-09-14', categoryId: 'family', debtId: 'debt_1' }));

    const row = getBudgetVsActual(data, SEP).rows.find((r) => r.category.id === 'family')!;
    assert.equal(row.spent, 5_000, 'the repayment is ordinary spending against Family');
    assert.equal(row.remaining, 6_000);

    const detail = getCategoryDetail(data, SEP, 'family')!;
    assert.equal(detail.transactionCount, 1, 'and it shows up in the category drill-down');
  });

  it('marks an unpaid debt past its due date as overdue', () => {
    const data = baseData();
    data.debts.push({
      id: 'debt_2',
      person: 'Bank',
      direction: 'payable',
      amount: 1_000,
      date: '2020-01-01',
      dueDate: '2020-02-01',
      description: '',
      notes: '',
      createdAt: '2020-01-01T00:00:00.000Z',
    });
    assert.equal(getDebtOverview(data).payable[0].status, 'overdue');
    assert.equal(getDebtOverview(data).overdueCount, 1);
  });
});

describe('comparisons and yearly totals', () => {
  it('reports the drop against the previous month', () => {
    const data = baseData();
    data.expenses.push(
      txn({ amount: 58_200, date: '2026-08-11', categoryId: 'food' }),
      txn({ amount: 42_350, date: '2026-09-11', categoryId: 'food' }),
    );

    const comparison = getSpendingComparison(data, SEP);
    assert.equal(comparison.direction, 'down');
    assert.equal(Number(comparison.percentChange.toFixed(1)), 27.2);
  });

  it('treats a first month with no history as flat rather than infinite', () => {
    const data = baseData();
    data.expenses.push(txn({ amount: 5_000, date: '2026-09-11' }));
    const comparison = getSpendingComparison(data, SEP);
    assert.equal(comparison.previous, 0);
    assert.equal(comparison.percentChange, 0);
  });

  it('averages only over months that had activity', () => {
    const data = baseData();
    data.income.push(income(100_000, '2026-08-01'), income(120_000, '2026-09-01'));
    data.expenses.push(
      txn({ amount: 40_000, date: '2026-08-11', categoryId: 'food' }),
      txn({ amount: 60_000, date: '2026-09-11', categoryId: 'food' }),
    );

    const year = getYearSummary(data, '2026');
    assert.equal(year.income, 220_000);
    assert.equal(year.expenses, 100_000);
    assert.equal(year.monthsWithActivity, 2);
    assert.equal(year.averageMonthlyExpense, 50_000);
  });
});
