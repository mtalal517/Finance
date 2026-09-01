import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createDebt } from '@/lib/data/debts';

export async function POST(request: Request) {
  return handle(async () => {
    const debt = await createDebt(await readJsonBody(request));
    return jsonOk({ debt }, 201);
  });
}
