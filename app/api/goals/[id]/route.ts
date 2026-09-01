import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteGoal, updateGoal } from '@/lib/data/goals';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const goal = await updateGoal(id, await readJsonBody(request));
    return jsonOk({ goal });
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await deleteGoal(id);
    return jsonOk({ deleted: id });
  });
}
