import 'server-only';
import { updateData } from './store';
import { createId } from './ids';
import { badRequest, notFound } from '../errors';
import { validateDeposit } from '../validation';
import type { Deposit } from '@/lib/types';

/**
 * Money placed into an account, tagged with what it is for.
 *
 * This is the one movement that is neither earning nor spending, so it lives in
 * its own array: `getMonthSummary` reads income and transactions, and cannot
 * see this at all. It moves a balance and answers "what is this money for?" —
 * nothing else.
 */

export async function createDeposit(body: unknown): Promise<Deposit> {
  const { result } = await updateData((data) => {
    const validated = validateDeposit(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const entry: Deposit = {
      id: createId('dep', data.deposits.map((d) => d.id)),
      ...validated.value,
      createdAt: new Date().toISOString(),
    };
    data.deposits.push(entry);
    return entry;
  });
  return result;
}

export async function updateDeposit(id: string, body: unknown): Promise<Deposit> {
  const { result } = await updateData((data) => {
    const index = data.deposits.findIndex((d) => d.id === id);
    if (index === -1) throw notFound('That entry could not be found.');

    const validated = validateDeposit(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const existing = data.deposits[index];
    const updated: Deposit = {
      ...existing,
      ...validated.value,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    data.deposits[index] = updated;
    return updated;
  });
  return result;
}

export async function deleteDeposit(id: string): Promise<void> {
  await updateData((data) => {
    const index = data.deposits.findIndex((d) => d.id === id);
    if (index === -1) throw notFound('That entry could not be found.');
    data.deposits.splice(index, 1);
  });
}
