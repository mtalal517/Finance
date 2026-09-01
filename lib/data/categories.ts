import 'server-only';
import { updateData } from './store';
import { uniqueSlug } from './ids';
import { badRequest, conflict, notFound } from '../errors';
import { validateCategory } from '../validation';
import type { Category } from '@/lib/types';

export async function createCategory(body: unknown): Promise<Category> {
  const { result } = await updateData((data) => {
    const validated = validateCategory(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const name = validated.value.name;
    if (data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw conflict('A category with that name already exists.');
    }

    const category: Category = {
      id: uniqueSlug(name, data.categories.map((c) => c.id)),
      ...validated.value,
    };
    data.categories.push(category);
    return category;
  });
  return result;
}

export async function updateCategory(id: string, body: unknown): Promise<Category> {
  const { result } = await updateData((data) => {
    const index = data.categories.findIndex((c) => c.id === id);
    if (index === -1) throw notFound('That category could not be found.');

    const validated = validateCategory(body);
    if (!validated.ok) throw badRequest(validated.message, validated.fieldErrors);

    const name = validated.value.name;
    if (data.categories.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      throw conflict('A category with that name already exists.');
    }

    // Renaming keeps the id, so every past transaction stays attached.
    const updated: Category = { ...data.categories[index], ...validated.value, id };
    data.categories[index] = updated;
    return updated;
  });
  return result;
}

export interface CategoryUsage {
  transactions: number;
  budgets: number;
}

export type CategoryDeleteStrategy = 'strict' | 'reassign' | 'delete-transactions';

/**
 * A category with history cannot just vanish — the spend has to go somewhere.
 * `strict` refuses and reports the usage; `reassign` moves its transactions to
 * another category; `delete-transactions` removes them outright. Budget
 * allocations for the category are dropped in every case.
 */
export async function deleteCategory(
  id: string,
  strategy: CategoryDeleteStrategy = 'strict',
  reassignTo?: string,
): Promise<CategoryUsage> {
  const { result } = await updateData((data) => {
    const index = data.categories.findIndex((c) => c.id === id);
    if (index === -1) throw notFound('That category could not be found.');
    if (data.categories.length === 1) {
      throw conflict('This is your last category — add another one before deleting it.');
    }

    const usage: CategoryUsage = {
      transactions: data.expenses.filter((t) => t.categoryId === id).length,
      budgets: data.budgets.filter((b) => id in b.categories).length,
    };

    if (usage.transactions > 0) {
      if (strategy === 'strict') {
        throw conflict(
          `${usage.transactions} transaction${usage.transactions === 1 ? '' : 's'} use this category. Choose what should happen to them.`,
        );
      }

      if (strategy === 'reassign') {
        if (!reassignTo || reassignTo === id) {
          throw badRequest('Choose a category to move these transactions into.');
        }
        if (!data.categories.some((c) => c.id === reassignTo)) {
          throw badRequest('That replacement category no longer exists.');
        }
        for (const t of data.expenses) if (t.categoryId === id) t.categoryId = reassignTo;
      } else {
        data.expenses = data.expenses.filter((t) => t.categoryId !== id);
      }
    }

    for (const budget of data.budgets) delete budget.categories[id];
    data.categories.splice(index, 1);
    return usage;
  });
  return result;
}
