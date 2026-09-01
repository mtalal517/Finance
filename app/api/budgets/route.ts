import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteBudget, saveBudget } from '@/lib/data/budgets';
import { AppError } from '@/lib/errors';
import { isValidMonth } from '@/lib/finance/dates';

/** The whole month's allocation set is saved at once, so PUT rather than PATCH. */
export async function PUT(request: Request) {
  return handle(async () => {
    const budget = await saveBudget(await readJsonBody(request));
    return jsonOk({ budget });
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const month = new URL(request.url).searchParams.get('month') ?? '';
    if (!isValidMonth(month)) throw new AppError('Choose a valid month.', 400);
    await deleteBudget(month);
    return jsonOk({ deleted: month });
  });
}
