import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteIncome, updateIncome } from '@/lib/data/income';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const entry = await updateIncome(id, await readJsonBody(request));
    return jsonOk({ entry });
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await deleteIncome(id);
    return jsonOk({ deleted: id });
  });
}
