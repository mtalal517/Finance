import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createIncome } from '@/lib/data/income';

export async function POST(request: Request) {
  return handle(async () => {
    const entry = await createIncome(await readJsonBody(request));
    return jsonOk({ entry }, 201);
  });
}
