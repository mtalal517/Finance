import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { restoreBackup } from '@/lib/data/store';
import { AppError } from '@/lib/errors';

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJsonBody(request)) as { name?: unknown };
    if (typeof body.name !== 'string' || !body.name) {
      throw new AppError('Choose a backup to restore.', 400);
    }
    // The file being replaced is itself backed up first, so a restore is undoable.
    await restoreBackup(body.name);
    return jsonOk({ restored: body.name });
  });
}
