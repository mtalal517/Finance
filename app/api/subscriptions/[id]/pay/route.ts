import { handle, jsonOk } from '@/lib/api';
import { paySubscription } from '@/lib/data/subscriptions';

type Context = { params: Promise<{ id: string }> };

/**
 * Records this period's charge. The body is empty on purpose — everything the
 * charge needs (amount, category, account, the date it fell due) is already on
 * the subscription, and letting the browser send any of it would be letting it
 * decide what was owed.
 */
export async function POST(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const { subscription, transaction } = await paySubscription(id);
    return jsonOk({ subscription, transaction }, 201);
  });
}
