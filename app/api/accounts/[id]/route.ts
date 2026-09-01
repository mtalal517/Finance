import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteAccount, updateAccount } from '@/lib/data/accounts';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const account = await updateAccount(id, await readJsonBody(request));
    return jsonOk({ account });
  });
}

export async function DELETE(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const strategy = new URL(request.url).searchParams.get('strategy') === 'unassign' ? 'unassign' : 'strict';
    await deleteAccount(id, strategy);
    return jsonOk({ deleted: id });
  });
}
