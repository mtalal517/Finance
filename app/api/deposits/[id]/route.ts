import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteDeposit, updateDeposit } from '@/lib/data/deposits';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const deposit = await updateDeposit(id, await readJsonBody(request));
    return jsonOk({ deposit });
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await deleteDeposit(id);
    return jsonOk({ deleted: id });
  });
}
