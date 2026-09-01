import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { replaceData } from '@/lib/data/store';
import { createEmptyData } from '@/lib/data/defaults';
import { AppError } from '@/lib/errors';

/**
 * Wipes everything back to default categories and accounts. Guarded by an
 * explicit confirmation string, and the old file is backed up first.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJsonBody(request)) as { confirm?: unknown };
    if (body.confirm !== 'ERASE') {
      throw new AppError('Type ERASE to confirm you want to delete everything.', 400);
    }
    await replaceData(createEmptyData(), 'pre-reset');
    return jsonOk({ reset: true });
  });
}
