import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateBudget,
  validateDebt,
  validateDebtPayment,
  validateGoal,
  validateIncome,
  validateTransaction,
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
