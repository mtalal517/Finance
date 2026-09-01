import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createSubscription } from '@/lib/data/subscriptions';

export async function POST(request: Request) {
  return handle(async () => {
    const subscription = await createSubscription(await readJsonBody(request));
    return jsonOk({ subscription }, 201);
  });
}
