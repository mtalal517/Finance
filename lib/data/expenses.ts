import 'server-only';
import { updateData } from './store';
import { createId } from './ids';
import { badRequest, notFound } from '../errors';
import { validateTransaction } from '../validation';
import type { Transaction } from '@/lib/types';

/**
 * Transaction CRUD. The UI never sends a total or a balance — only the fields of
 * a single row — and everything is re-validated here against the file as it
 * exists at write time.
 */

export async function createTransaction(body: unknown): Promise<Transaction> {
  const { result } = await updateData((data) => {
    const validated = validateTransaction(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const transaction: Transaction = {
      id: createId('exp', data.expenses.map((t) => t.id)),
      ...validated.value,
      createdAt: new Date().toISOString(),
    };
    data.expenses.push(transaction);
    return transaction;
  });
  return result;
}

export async function updateTransaction(id: string, body: unknown): Promise<Transaction> {
  const { result } = await updateData((data) => {
    const index = data.expenses.findIndex((t) => t.id === id);
    if (index === -1) throw notFound('That transaction could not be found.');

    const validated = validateTransaction(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const existing = data.expenses[index];
    const updated: Transaction = {
      ...existing,
      ...validated.value,
      // A debt link is structural — editing the row must not silently break it.
      debtId: existing.debtId ?? validated.value.debtId,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    data.expenses[index] = updated;
    return updated;
  });
  return result;
}

export async function deleteTransaction(id: string): Promise<void> {
  await updateData((data) => {
    const index = data.expenses.findIndex((t) => t.id === id);
    if (index === -1) throw notFound('That transaction could not be found.');
    data.expenses.splice(index, 1);
  });
}
