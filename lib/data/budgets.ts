import 'server-only';
import { updateData } from './store';
import { badRequest } from '../errors';
import { validateBudget } from '../validation';
import { addMonths } from '../finance/dates';
import type { Budget } from '@/lib/types';

/**
 * A budget is nothing but a month plus a set of allocations. `spent` and
 * `remaining` are never stored — they are derived from transactions every time
 * they are displayed, so the two can never disagree.
 */

function budgetId(month: string): string {
  return `budget_${month.replace('-', '_')}`;
}

/** Creates or replaces the whole allocation set for one month. */
export async function saveBudget(body: unknown): Promise<Budget> {
  const { result } = await updateData((data) => {
    const validated = validateBudget(data, body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const { month, categories } = validated.value;
    const budget: Budget = { id: budgetId(month), month, categories };

    const index = data.budgets.findIndex((b) => b.month === month);
    if (index === -1) data.budgets.push(budget);
    else data.budgets[index] = budget;

    data.budgets.sort((a, b) => a.month.localeCompare(b.month));
    return budget;
  });
  return result;
}

export async function deleteBudget(month: string): Promise<void> {
  await updateData((data) => {
    const index = data.budgets.findIndex((b) => b.month === month);
    if (index !== -1) data.budgets.splice(index, 1);
  });
}

/**
 * Copies the previous month's allocations forward, so a recurring budget does
 * not have to be retyped every month. Refuses to clobber an existing budget.
 */
export async function copyPreviousBudget(month: string): Promise<Budget> {
  const { result } = await updateData((data) => {
    const source = data.budgets.find((b) => b.month === addMonths(month, -1));
    if (!source || Object.keys(source.categories).length === 0) {
      throw badRequest('There is no budget in the previous month to copy.');
    }
    if (data.budgets.some((b) => b.month === month && Object.keys(b.categories).length > 0)) {
      throw badRequest('This month already has a budget. Clear it first if you want to start over.');
    }

    const budget: Budget = {
      id: budgetId(month),
      month,
      categories: { ...source.categories },
    };
    const index = data.budgets.findIndex((b) => b.month === month);
    if (index === -1) data.budgets.push(budget);
    else data.budgets[index] = budget;

    data.budgets.sort((a, b) => a.month.localeCompare(b.month));
    return budget;
  });
  return result;
}
