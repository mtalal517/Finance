import { handle, jsonOk, readJsonBody } from '@/lib/api';
import { recordDebtPayment } from '@/lib/data/debts';

type Context = { params: Promise<{ id: string }> };

/**
 * Records a repayment. On a debt you owe, the body carries the allocation the
 * money comes out of, and the resulting row is an ordinary transaction against
 * that budget category.
 */
export async function POST(request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const transaction = await recordDebtPayment(id, await readJsonBody(request));
    return jsonOk({ transaction }, 201);
  });
}
