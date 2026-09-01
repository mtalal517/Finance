import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createTransaction } from '@/lib/data/expenses';

export async function POST(request: Request) {
  return handle(async () => {
    const transaction = await createTransaction(await readJsonBody(request));
    return jsonOk({ transaction }, 201);
  });
}
