import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { copyPreviousBudget } from '@/lib/data/budgets';
import { AppError } from '@/lib/errors';
import { isValidMonth } from '@/lib/finance/dates';

/** Carries last month's allocations forward so a recurring budget is one click. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJsonBody(request)) as { month?: unknown };
    const month = typeof body.month === 'string' ? body.month : '';
    if (!isValidMonth(month)) throw new AppError('Choose a valid month.', 400);
    const budget = await copyPreviousBudget(month);
    return jsonOk({ budget });
  });
}
