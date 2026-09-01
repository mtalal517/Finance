import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteSubscription, updateSubscription } from '@/lib/data/subscriptions';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const subscription = await updateSubscription(id, await readJsonBody(request));
    return jsonOk({ subscription });
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await deleteSubscription(id);
    return jsonOk({ deleted: id });
  });
}
