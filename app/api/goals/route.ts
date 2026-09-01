import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { createGoal } from '@/lib/data/goals';

export async function POST(request: Request) {
  return handle(async () => {
    const goal = await createGoal(await readJsonBody(request));
    return jsonOk({ goal }, 201);
  });
}
