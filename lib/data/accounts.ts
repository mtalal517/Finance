import 'server-only';
import { updateData } from './store';
import { uniqueSlug } from './ids';
import { badRequest, conflict, notFound } from '../errors';
import { validateAccount } from '../validation';
import type { Account } from '@/lib/types';

export async function createAccount(body: unknown): Promise<Account> {
  const { result } = await updateData((data) => {
    const validated = validateAccount(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const name = validated.value.name;
    if (data.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      throw conflict('An account with that name already exists.');
    }

    const account: Account = {
      id: uniqueSlug(name, data.accounts.map((a) => a.id)),
      ...validated.value,
    };
    data.accounts.push(account);
    return account;
  });
  return result;
}

export async function updateAccount(id: string, body: unknown): Promise<Account> {
  const { result } = await updateData((data) => {
    const index = data.accounts.findIndex((a) => a.id === id);
    if (index === -1) throw notFound('That account could not be found.');

    const validated = validateAccount(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const name = validated.value.name;
    if (data.accounts.some((a) => a.id !== id && a.name.toLowerCase() === name.toLowerCase())) {
      throw conflict('An account with that name already exists.');
    }

    // The id is never regenerated on rename — transactions point at it.
    const updated: Account = { ...data.accounts[index], ...validated.value, id };
    data.accounts[index] = updated;
    return updated;
  });
  return result;
}

export interface AccountUsage {
  transactions: number;
  income: number;
  deposits: number;
}

/**
 * Deleting an account that has history would orphan those rows, so the caller
 * must say what to do: `unassign` keeps the transactions but clears the account
 * (they still count towards spending, just not towards a balance).
 *
 * Money added to the account is the exception — it cannot be unassigned, since
 * a deposit with no account records nothing at all. Those rows go with it.
 */
export async function deleteAccount(id: string, strategy: 'unassign' | 'strict' = 'strict'): Promise<void> {
  await updateData((data) => {
    const index = data.accounts.findIndex((a) => a.id === id);
    if (index === -1) throw notFound('That account could not be found.');

    const usage: AccountUsage = {
      transactions: data.expenses.filter((t) => t.accountId === id).length,
      income: data.income.filter((i) => i.accountId === id).length,
      deposits: data.deposits.filter((d) => d.accountId === id).length,
    };
    const total = usage.transactions + usage.income + usage.deposits;

    if (total > 0 && strategy === 'strict') {
      throw conflict(
        `This account is used by ${total} entr${total === 1 ? 'y' : 'ies'}. Confirm how you want to handle them before deleting it.`,
      );
    }

    if (strategy === 'unassign') {
      for (const t of data.expenses) if (t.accountId === id) t.accountId = null;
      for (const i of data.income) if (i.accountId === id) i.accountId = null;
      data.deposits = data.deposits.filter((d) => d.accountId !== id);
    }

    data.accounts.splice(index, 1);
  });
}
