import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { addContribution } from '@/lib/data/goals';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const goal = await addContribution(id, await readJsonBody(request));
    return jsonOk({ goal }, 201);
  });
}
