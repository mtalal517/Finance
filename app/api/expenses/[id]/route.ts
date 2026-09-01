import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteTransaction, updateTransaction } from '@/lib/data/expenses';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const transaction = await updateTransaction(id, await readJsonBody(request));
    return jsonOk({ transaction });
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await deleteTransaction(id);
    return jsonOk({ deleted: id });
  });
}
