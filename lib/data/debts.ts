import 'server-only';
import { updateData } from './store';
import { createId } from './ids';
import { badRequest, notFound } from '../errors';
import { validateDebt, validateDebtPayment } from '../validation';
import type { Debt, Transaction } from '@/lib/types';

/**
 * Debts you owe and money owed to you.
 *
 * Creating a debt records who and how much — it moves no money. Repayments are
 * where money actually moves, and they are written as ordinary transactions
 * carrying a `debtId` rather than into a separate ledger. That single decision
 * is what makes a repayment count against its budget category, show up in the
 * category drill-down, hit the account balance and appear in analytics without
 * a line of debt-specific code in any of them.
 */

function outstandingOf(debt: Debt, transactions: Transaction[]): number {
  const paid = transactions
    .filter((t) => t.debtId === debt.id)
    .reduce((total, t) => total + t.amount, 0);
  return Math.round((debt.amount - paid) * 100) / 100;
}

export async function createDebt(body: unknown): Promise<Debt> {
  const { result } = await updateData((data) => {
    const validated = validateDebt(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const debt: Debt = {
      id: createId('debt', data.debts.map((d) => d.id)),
      ...validated.value,
      createdAt: new Date().toISOString(),
    };
    data.debts.push(debt);
    return debt;
  });
  return result;
}

export async function updateDebt(id: string, body: unknown): Promise<Debt> {
  const { result } = await updateData((data) => {
    const index = data.debts.findIndex((d) => d.id === id);
    if (index === -1) throw notFound('That debt could not be found.');

    const validated = validateDebt(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const existing = data.debts[index];
    // Changing direction after money has moved would flip the sign of real
    // transactions, so it is only allowed while the debt has no payments.
    const hasPayments = data.expenses.some((t) => t.debtId === id);
    if (hasPayments && validated.value.direction !== existing.direction) {
      throw badRequest('Remove the recorded payments before changing the direction of this debt.');
    }

    const updated: Debt = {
      ...existing,
      ...validated.value,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    data.debts[index] = updated;
    return updated;
  });
  return result;
}

/**
 * Deleting a debt keeps its payments — that money genuinely left the account,
 * and erasing it would quietly inflate every balance. The rows simply stop
 * pointing at a debt.
 */
export async function deleteDebt(id: string): Promise<void> {
  await updateData((data) => {
    const index = data.debts.findIndex((d) => d.id === id);
    if (index === -1) throw notFound('That debt could not be found.');
    for (const t of data.expenses) if (t.debtId === id) t.debtId = null;
    data.debts.splice(index, 1);
  });
}

export async function recordDebtPayment(debtId: string, body: unknown): Promise<Transaction> {
  const { result } = await updateData((data) => {
    const debt = data.debts.find((d) => d.id === debtId);
    if (!debt) throw notFound('That debt could not be found.');

    const validated = validateDebtPayment(data, debt.direction, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const outstanding = outstandingOf(debt, data.expenses);
    if (outstanding <= 0) {
      throw badRequest('This debt is already fully settled.');
    }
    if (validated.value.amount > outstanding + 0.005) {
      throw badRequest(
        `That is more than the ${data.settings.currencySymbol} ${outstanding.toLocaleString('en-US')} still outstanding. Edit the debt amount first if it has grown.`,
        { amount: 'More than the outstanding balance.' },
      );
    }

    const verb = debt.direction === 'payable' ? 'Debt payment' : 'Repayment received';
    const description = validated.value.note || `${verb} — ${debt.person}`;

    const transaction: Transaction = {
      id: createId('exp', data.expenses.map((t) => t.id)),
      amount: validated.value.amount,
      // On a payable this is the allocation the money comes out of, which is
      // exactly what makes it count against that budget.
      categoryId: validated.value.categoryId,
      date: validated.value.date,
      description,
      accountId: validated.value.accountId,
      notes: '',
      subscriptionId: null,
      goalId: null,
      direction: debt.direction === 'payable' ? 'out' : 'in',
      debtId: debt.id,
      createdAt: new Date().toISOString(),
    };

    data.expenses.push(transaction);
    return transaction;
  });
  return result;
}
