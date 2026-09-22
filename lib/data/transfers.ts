import 'server-only';
import { updateData } from './store';
import { createId } from './ids';
import { badRequest, notFound } from '../errors';
import { validateTransfer } from '../validation';
import type { Transfer } from '@/lib/types';

/**
 * Money moved between two of your own accounts.
 *
 * Lives in its own array for the same reason deposits do: `getMonthSummary`
 * reads income and transactions and must never see this. A transfer moves a
 * balance from one side to the other and, when tagged, moves the pot with it.
 */

export async function createTransfer(body: unknown): Promise<Transfer> {
  const { result } = await updateData((data) => {
    const validated = validateTransfer(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const entry: Transfer = {
      id: createId('tr', data.transfers.map((t) => t.id)),
      ...validated.value,
      createdAt: new Date().toISOString(),
    };
    data.transfers.push(entry);
    return entry;
  });
  return result;
}

export async function updateTransfer(id: string, body: unknown): Promise<Transfer> {
  const { result } = await updateData((data) => {
    const index = data.transfers.findIndex((t) => t.id === id);
    if (index === -1) throw notFound('That transfer could not be found.');

    const validated = validateTransfer(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const existing = data.transfers[index];
    const updated: Transfer = {
      ...existing,
      ...validated.value,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    data.transfers[index] = updated;
    return updated;
  });
  return result;
}

export async function deleteTransfer(id: string): Promise<void> {
  await updateData((data) => {
    const index = data.transfers.findIndex((t) => t.id === id);
    if (index === -1) throw notFound('That transfer could not be found.');
    data.transfers.splice(index, 1);
  });
}
