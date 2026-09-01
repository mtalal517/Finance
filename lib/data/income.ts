import 'server-only';
import { updateData } from './store';
import { createId } from './ids';
import { badRequest, notFound } from '../errors';
import { validateIncome } from '../validation';
import type { IncomeEntry } from '@/lib/types';

/**
 * Income CRUD. A month's salary is just an income row dated inside that month,
 * so nothing assumes the amount repeats or stays the same month to month.
 */

export async function createIncome(body: unknown): Promise<IncomeEntry> {
  const { result } = await updateData((data) => {
    const validated = validateIncome(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const entry: IncomeEntry = {
      id: createId('inc', data.income.map((i) => i.id)),
      ...validated.value,
      createdAt: new Date().toISOString(),
    };
    data.income.push(entry);
    return entry;
  });
  return result;
}

export async function updateIncome(id: string, body: unknown): Promise<IncomeEntry> {
  const { result } = await updateData((data) => {
    const index = data.income.findIndex((i) => i.id === id);
    if (index === -1) throw notFound('That income entry could not be found.');

    const validated = validateIncome(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const existing = data.income[index];
    const updated: IncomeEntry = {
      ...existing,
      ...validated.value,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    data.income[index] = updated;
    return updated;
  });
  return result;
}

export async function deleteIncome(id: string): Promise<void> {
  await updateData((data) => {
    const index = data.income.findIndex((i) => i.id === id);
    if (index === -1) throw notFound('That income entry could not be found.');
    data.income.splice(index, 1);
  });
}
