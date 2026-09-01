import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createCategory } from '@/lib/data/categories';

export async function POST(request: Request) {
  return handle(async () => {
    const category = await createCategory(await readJsonBody(request));
    return jsonOk({ category }, 201);
  });
}
