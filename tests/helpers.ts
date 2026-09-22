import { createEmptyData } from '../lib/data/defaults';
import type { Deposit, FinanceData, Subscription, Transaction, Transfer } from '../lib/types';

/** Builders that keep the tests about the behaviour rather than about setup. */

export function baseData(): FinanceData {
  return createEmptyData();
}

let counter = 0;

export function txn(partial: Partial<Transaction> & { amount: number; date: string }): Transaction {
  counter += 1;
  return {
    id: `exp_${counter}`,
    amount: partial.amount,
    categoryId: partial.categoryId ?? 'transport',
    date: partial.date,
    description: partial.description ?? '',
    accountId: partial.accountId ?? null,
    notes: partial.notes ?? '',
    direction: partial.direction ?? 'out',
    debtId: partial.debtId ?? null,
    subscriptionId: partial.subscriptionId ?? null,
    goalId: partial.goalId ?? null,
    createdAt: partial.createdAt ?? `2026-09-01T00:00:0${counter % 10}.000Z`,
  };
}

export function income(
  amount: number,
  date: string,
  extra: { type?: 'salary' | 'bonus' | 'freelance' | 'other'; accountId?: string | null } = {},
) {
  counter += 1;
  return {
    id: `inc_${counter}`,
    date,
    type: extra.type ?? ('salary' as const),
    description: '',
    amount,
    accountId: extra.accountId ?? null,
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}

export function subscription(partial: Partial<Subscription> = {}): Subscription {
  counter += 1;
  return {
    id: partial.id ?? `sub_${counter}`,
    name: partial.name ?? 'Netflix',
    amount: partial.amount ?? 1_200,
    cycle: partial.cycle ?? 'monthly',
    nextDueDate: partial.nextDueDate ?? '2026-09-15',
    categoryId: partial.categoryId ?? 'subscriptions',
    accountId: partial.accountId ?? null,
    icon: partial.icon ?? 'repeat',
    active: partial.active ?? true,
    notes: partial.notes ?? '',
    createdAt: partial.createdAt ?? '2026-09-01T00:00:00.000Z',
  };
}

export function deposit(partial: Partial<Deposit> & { amount: number }): Deposit {
  counter += 1;
  return {
    id: partial.id ?? `dep_${counter}`,
    accountId: partial.accountId ?? 'bank',
    amount: partial.amount,
    // `null` is a real choice now — money added need not say what it is for —
    // so only an absent key falls back to a category.
    categoryId: 'categoryId' in partial ? (partial.categoryId ?? null) : 'savings',
    date: partial.date ?? '2026-09-01',
    note: partial.note ?? '',
    createdAt: partial.createdAt ?? '2026-09-01T00:00:00.000Z',
  };
}

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
