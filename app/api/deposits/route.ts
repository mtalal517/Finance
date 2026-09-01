import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createDeposit } from '@/lib/data/deposits';

export async function POST(request: Request) {
  return handle(async () => {
    const deposit = await createDeposit(await readJsonBody(request));
    return jsonOk({ deposit }, 201);
  });
}
