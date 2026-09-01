import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { saveSettings } from '@/lib/data/settings';

export async function PUT(request: Request) {
  return handle(async () => {
    const settings = await saveSettings(await readJsonBody(request));
    return jsonOk({ settings });
  });
}
