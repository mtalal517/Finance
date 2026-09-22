import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteTransfer, updateTransfer } from '@/lib/data/transfers';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const transfer = await updateTransfer(id, await readJsonBody(request));
    return jsonOk({ transfer });
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await deleteTransfer(id);
    return jsonOk({ deleted: id });
  });
}
