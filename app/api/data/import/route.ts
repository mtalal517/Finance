import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { replaceData } from '@/lib/data/store';
import { AppError } from '@/lib/errors';

/**
 * Replaces everything with an uploaded export. The current file is backed up
 * first, so a mistaken import is always one restore away from being undone.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJsonBody(request);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new AppError('That file does not look like a finance export.', 400);
    }
    const data = await replaceData(body, 'pre-import');
    return jsonOk({
      summary: {
        income: data.income.length,
        expenses: data.expenses.length,
        budgets: data.budgets.length,
        goals: data.goals.length,
        debts: data.debts.length,
        categories: data.categories.length,
        accounts: data.accounts.length,
      },
    });
  });
}
