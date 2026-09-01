import { handle, jsonOk } from '@/lib/api';
import { deleteContribution } from '@/lib/data/goals';

type Context = { params: Promise<{ id: string; contributionId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id, contributionId } = await params;
    const goal = await deleteContribution(id, contributionId);
    return jsonOk({ goal });
  });
}
