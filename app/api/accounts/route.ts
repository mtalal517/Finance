import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createAccount } from '@/lib/data/accounts';

export async function POST(request: Request) {
  return handle(async () => {
    const account = await createAccount(await readJsonBody(request));
    return jsonOk({ account }, 201);
  });
}
