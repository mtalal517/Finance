import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createTransfer } from '@/lib/data/transfers';

export async function POST(request: Request) {
  return handle(async () => {
    const transfer = await createTransfer(await readJsonBody(request));
    return jsonOk({ transfer }, 201);
  });
}
