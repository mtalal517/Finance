import { createEmptyData } from '../lib/data/defaults';
import type { FinanceData, Transaction } from '../lib/types';

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
