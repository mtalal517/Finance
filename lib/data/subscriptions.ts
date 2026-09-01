import 'server-only';
import { updateData } from './store';
import { createId } from './ids';
import { badRequest, notFound } from '../errors';
import { validateSubscription } from '../validation';
import { addMonthsToDate } from '../finance/dates';
import type { BillingCycle, Subscription, Transaction } from '@/lib/types';

/**
 * Subscription CRUD, plus the one interesting operation: paying it.
 *
 * A subscription is a standing instruction, not money — recording it moves
 * nothing. Paying it writes an ordinary transaction, exactly as recording a
 * debt repayment does, so the charge counts against its budget category,
 * reduces the account it came out of and shows up in analytics with no separate
 * subscription ledger to fall out of step.
 */

const MONTHS_PER_CYCLE: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export async function createSubscription(body: unknown): Promise<Subscription> {
  const { result } = await updateData((data) => {
    const validated = validateSubscription(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const subscription: Subscription = {
      id: createId('sub', data.subscriptions.map((s) => s.id)),
      ...validated.value,
      createdAt: new Date().toISOString(),
    };
    data.subscriptions.push(subscription);
    return subscription;
  });
  return result;
}

export async function updateSubscription(id: string, body: unknown): Promise<Subscription> {
  const { result } = await updateData((data) => {
    const index = data.subscriptions.findIndex((s) => s.id === id);
    if (index === -1) throw notFound('That subscription could not be found.');

    const validated = validateSubscription(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const existing = data.subscriptions[index];
    const updated: Subscription = {
      ...existing,
      ...validated.value,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    data.subscriptions[index] = updated;
    return updated;
  });
  return result;
}

/**
 * Deleting keeps the payments. Those charges really did leave an account, so
 * removing them would inflate every balance — the same rule debts follow. The
 * rows lose their link and stay as ordinary expenses.
 */
export async function deleteSubscription(id: string): Promise<void> {
  await updateData((data) => {
    const index = data.subscriptions.findIndex((s) => s.id === id);
    if (index === -1) throw notFound('That subscription could not be found.');

    data.subscriptions.splice(index, 1);
    for (const transaction of data.expenses) {
      if (transaction.subscriptionId === id) transaction.subscriptionId = null;
    }
  });
}

/**
 * Records this period's charge and rolls the due date on to the next one.
 *
 * The transaction is dated the day it fell due rather than today, so a
 * subscription paid late still lands in the month it belonged to. Both halves
 * happen in one `updateData`, so there is no state where the money is recorded
 * but the date has not moved.
 */
export async function paySubscription(
  id: string,
): Promise<{ subscription: Subscription; transaction: Transaction }> {
  const { result } = await updateData((data) => {
    const subscription = data.subscriptions.find((s) => s.id === id);
    if (!subscription) throw notFound('That subscription could not be found.');
    if (!subscription.active) {
      throw badRequest('That subscription is paused. Resume it before recording a payment.');
    }
    if (!subscription.categoryId) {
      throw badRequest('Give this subscription a category before recording a payment.');
    }

    const transaction: Transaction = {
      id: createId('exp', data.expenses.map((t) => t.id)),
      amount: subscription.amount,
      categoryId: subscription.categoryId,
      date: subscription.nextDueDate,
      description: subscription.name,
      accountId: subscription.accountId,
      notes: '',
      direction: 'out',
      debtId: null,
      subscriptionId: subscription.id,
      createdAt: new Date().toISOString(),
    };
    data.expenses.push(transaction);

    subscription.nextDueDate = addMonthsToDate(
      subscription.nextDueDate,
      MONTHS_PER_CYCLE[subscription.cycle],
    );

    return { subscription, transaction };
  });
  return result;
}
