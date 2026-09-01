import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteDebt, updateDebt } from '@/lib/data/debts';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const debt = await updateDebt(id, await readJsonBody(request));
    return jsonOk({ debt });
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await deleteDebt(id);
    return jsonOk({ deleted: id });
  });
}
