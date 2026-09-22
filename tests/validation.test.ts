import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateBudget,
  validateDebt,
  validateDeposit,
  validateDebtPayment,
  validateGoal,
  validateIncome,
  validateSubscription,
  validateTransaction,
  validateTransfer,
} from '../lib/validation';
import { baseData } from './helpers';

describe('transaction validation', () => {
  const data = baseData();

  it('accepts a well-formed expense and normalises the amount', () => {
    const result = validateTransaction(data, {
      amount: '1,250.505',
      categoryId: 'food',
      date: '2026-09-22',
      description: 'Lunch',
      accountId: 'cash',
    });

    assert.ok(result.ok);
    assert.equal(result.value.amount, 1_250.51);
    assert.equal(result.value.direction, 'out');
  });

  it('rejects an amount of zero or less', () => {
    for (const amount of [0, -1, '0']) {
      const result = validateTransaction(data, { amount, categoryId: 'food', date: '2026-09-22' });
      assert.equal(result.ok, false);
      assert.match((result as { fieldErrors: Record<string, string> }).fieldErrors.amount, /greater than 0/);
    }
  });

  it('rejects a date that does not exist', () => {
    const result = validateTransaction(data, { amount: 100, categoryId: 'food', date: '2026-02-30' });
    assert.equal(result.ok, false);
    assert.ok((result as { fieldErrors: Record<string, string> }).fieldErrors.date);
  });

  it('requires a category for money going out', () => {
    const result = validateTransaction(data, { amount: 100, date: '2026-09-22' });
    assert.equal(result.ok, false);
    assert.ok((result as { fieldErrors: Record<string, string> }).fieldErrors.categoryId);
  });

  it('rejects a category or account that does not exist', () => {
    const bad = validateTransaction(data, {
      amount: 100,
      categoryId: 'ghost',
      accountId: 'ghost',
      date: '2026-09-22',
    });
    assert.equal(bad.ok, false);
    const errors = (bad as { fieldErrors: Record<string, string> }).fieldErrors;
    assert.ok(errors.categoryId);
    assert.ok(errors.accountId);
  });

  it('links an expense to a goal that exists and refuses one that does not', () => {
    const withGoal = baseData();
    withGoal.goals.push({
      id: 'g1',
      name: 'Medical',
      targetAmount: 50_000,
      initialAmount: 0,
      targetDate: null,
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      contributions: [],
    });

    const ok = validateTransaction(withGoal, { amount: 100, categoryId: 'food', date: '2026-09-22', goalId: 'g1' });
    assert.ok(ok.ok);
    assert.equal(ok.value.goalId, 'g1');

    const blank = validateTransaction(withGoal, { amount: 100, categoryId: 'food', date: '2026-09-22', goalId: '' });
    assert.ok(blank.ok);
    assert.equal(blank.value.goalId, null);

    const bad = validateTransaction(withGoal, { amount: 100, categoryId: 'food', date: '2026-09-22', goalId: 'ghost' });
    assert.equal(bad.ok, false);
    assert.ok((bad as { fieldErrors: Record<string, string> }).fieldErrors.goalId);
  });

  it('allows an incoming repayment with no category', () => {
    const result = validateTransaction(data, { amount: 100, date: '2026-09-22', direction: 'in' });
    assert.ok(result.ok);
    assert.equal(result.value.categoryId, null);
  });

  it('refuses a body that is not an object', () => {
    assert.equal(validateTransaction(data, 'nope').ok, false);
    assert.equal(validateTransaction(data, null).ok, false);
    assert.equal(validateTransaction(data, [1, 2]).ok, false);
  });
});

describe('income validation', () => {
  const data = baseData();

  it('requires a positive amount and a known type', () => {
    assert.equal(validateIncome(data, { amount: 0, type: 'salary', date: '2026-09-01' }).ok, false);
    assert.equal(validateIncome(data, { amount: 100, type: 'lottery', date: '2026-09-01' }).ok, false);
    assert.ok(validateIncome(data, { amount: 110_000, type: 'salary', date: '2026-09-01' }).ok);
  });
});

describe('budget validation', () => {
  const data = baseData();

  it('rejects a negative allocation', () => {
    const result = validateBudget(data, { month: '2026-09', categories: { food: -1 } });
    assert.equal(result.ok, false);
    assert.ok((result as { fieldErrors: Record<string, string> }).fieldErrors['categories.food']);
  });

  it('treats a blank field as no allocation rather than an error', () => {
    const result = validateBudget(data, { month: '2026-09', categories: { food: '', transport: '15000' } });
    assert.ok(result.ok);
    assert.deepEqual(result.value.categories, { transport: 15_000 });
  });

  it('rejects a malformed month', () => {
    assert.equal(validateBudget(data, { month: '2026-13', categories: {} }).ok, false);
    assert.equal(validateBudget(data, { month: 'September', categories: {} }).ok, false);
  });
});

describe('goal validation', () => {
  it('will not let the starting amount exceed the target', () => {
    const result = validateGoal({ name: 'Laptop', targetAmount: 100, initialAmount: 200 });
    assert.equal(result.ok, false);
    assert.ok((result as { fieldErrors: Record<string, string> }).fieldErrors.initialAmount);
  });

  it('allows a starting amount of zero', () => {
    assert.ok(validateGoal({ name: 'Laptop', targetAmount: 100, initialAmount: 0 }).ok);
  });
});

describe('debt validation', () => {
  const data = baseData();

  it('rejects a due date before the debt started', () => {
    const result = validateDebt({
      person: 'Ahmed',
      direction: 'payable',
      amount: 1_000,
      date: '2026-09-10',
      dueDate: '2026-09-01',
    });
    assert.equal(result.ok, false);
    assert.ok((result as { fieldErrors: Record<string, string> }).fieldErrors.dueDate);
  });

  it('requires an allocation when paying a debt you owe', () => {
    const missing = validateDebtPayment(data, 'payable', { amount: 500, date: '2026-09-14' });
    assert.equal(missing.ok, false);
    assert.ok((missing as { fieldErrors: Record<string, string> }).fieldErrors.categoryId);

    const provided = validateDebtPayment(data, 'payable', {
      amount: 500,
      date: '2026-09-14',
      categoryId: 'family',
    });
    assert.ok(provided.ok);
    assert.equal(provided.value.categoryId, 'family');
  });

  it('does not ask for an allocation on money coming back to you', () => {
    const result = validateDebtPayment(data, 'receivable', { amount: 500, date: '2026-09-14' });
    assert.ok(result.ok);
    assert.equal(result.value.categoryId, null);
  });
});

describe('subscription validation', () => {
  const data = baseData();

  const valid = {
    name: '  Netflix  ',
    amount: '1,200',
    cycle: 'monthly',
    nextDueDate: '2026-09-15',
    categoryId: 'subscriptions',
    accountId: 'bank',
    icon: 'repeat',
    active: true,
    notes: 'family plan',
  };

  it('accepts a well-formed subscription and trims the name', () => {
    const result = validateSubscription(data, valid);

    assert.ok(result.ok);
    assert.equal(result.value.name, 'Netflix');
    assert.equal(result.value.amount, 1_200);
    assert.equal(result.value.cycle, 'monthly');
    assert.equal(result.value.categoryId, 'subscriptions');
    assert.equal(result.value.active, true);
  });

  it('requires a name', () => {
    const result = validateSubscription(data, { ...valid, name: '   ' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.name);
  });

  it('rejects an amount of zero or less', () => {
    const result = validateSubscription(data, { ...valid, amount: '0' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.amount);
  });

  it('rejects a billing cycle it does not know', () => {
    const result = validateSubscription(data, { ...valid, cycle: 'weekly' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.cycle);
  });

  it('requires a category, because paying one writes an expense against it', () => {
    const result = validateSubscription(data, { ...valid, categoryId: '' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.categoryId);
  });

  it('rejects a category that no longer exists', () => {
    const result = validateSubscription(data, { ...valid, categoryId: 'gone' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.categoryId);
  });

  it('rejects a due date that is not a real date', () => {
    const result = validateSubscription(data, { ...valid, nextDueDate: '2026-02-30' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.nextDueDate);
  });

  it('treats a missing active flag as running', () => {
    const { active, ...withoutActive } = valid;
    const result = validateSubscription(data, withoutActive);

    assert.ok(result.ok);
    assert.equal(result.value.active, true);
  });
});

describe('deposit validation', () => {
  const data = baseData();

  const valid = {
    accountId: 'bank',
    amount: '20,000',
    categoryId: 'savings',
    date: '2026-09-01',
    note: 'Emergency fund',
  };

  it('accepts a well-formed deposit', () => {
    const result = validateDeposit(data, valid);

    assert.ok(result.ok);
    assert.equal(result.value.accountId, 'bank');
    assert.equal(result.value.amount, 20_000);
    assert.equal(result.value.categoryId, 'savings');
    assert.equal(result.value.note, 'Emergency fund');
  });

  it('requires an account, because the money has to go somewhere', () => {
    const result = validateDeposit(data, { ...valid, accountId: '' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.accountId);
  });

  it('rejects an account that no longer exists', () => {
    const result = validateDeposit(data, { ...valid, accountId: 'gone' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.accountId);
  });

  it('accepts one with no category, because saying what it is for is optional', () => {
    const result = validateDeposit(data, { ...valid, categoryId: '' });

    assert.ok(result.ok);
    assert.equal(result.value.categoryId, null);
  });

  it('still rejects a category that was named but does not exist', () => {
    const result = validateDeposit(data, { ...valid, categoryId: 'gone' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.categoryId);
  });

  it('rejects an amount of zero or less', () => {
    const result = validateDeposit(data, { ...valid, amount: '0' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.amount);
  });

  it('rejects a date that is not real', () => {
    const result = validateDeposit(data, { ...valid, date: '2026-02-31' });

    assert.ok(!result.ok);
    assert.ok(result.fieldErrors.date);
  });
});

describe('transfer validation', () => {
  const data = baseData();
  const MOVE = {
    fromAccountId: 'bank',
    toAccountId: 'cash',
    amount: 5_000,
    categoryId: 'savings',
    date: '2026-09-22',
    note: 'Top up',
  };

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
