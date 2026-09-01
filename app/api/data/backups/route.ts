import { handle, jsonOk } from '@/lib/api';
import { createBackup, listBackups } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => jsonOk({ backups: await listBackups() }));
}

export async function POST() {
  return handle(async () => {
    const name = await createBackup('manual');
    return jsonOk({ name, backups: await listBackups() }, 201);
  });
}
