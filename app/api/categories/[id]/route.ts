import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { deleteCategory, updateCategory, type CategoryDeleteStrategy } from '@/lib/data/categories';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const category = await updateCategory(id, await readJsonBody(request));
    return jsonOk({ category });
  });
}

/**
 * Deleting is refused by default when transactions exist. The client re-sends
 * with an explicit strategy once the user has chosen what happens to them.
 */
export async function DELETE(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const search = new URL(request.url).searchParams;
    const requested = search.get('strategy');
    const strategy: CategoryDeleteStrategy =
      requested === 'reassign' || requested === 'delete-transactions' ? requested : 'strict';

    const usage = await deleteCategory(id, strategy, search.get('reassignTo') ?? undefined);
    return jsonOk({ deleted: id, usage });
  });
}
