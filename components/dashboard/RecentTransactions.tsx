import { CornerDownLeft, Receipt } from 'lucide-react';
import { EmptyState, IconTile } from '@/components/ui/Primitives';
import { iconFor } from '@/lib/icons/registry';
import { formatCurrency } from '@/lib/finance/format';
import { formatDayMonth } from '@/lib/finance/dates';
import type { EnrichedTransaction } from '@/lib/finance/calculations';

/**
 * The last handful of entries. Money coming in is signed and green, so a
 * repayment received is never mistaken for spending.
 */
export function RecentTransactions({
  transactions,
  symbol,
}: {
  transactions: EnrichedTransaction[];
  symbol: string;
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Nothing recorded yet"
        body="Use Add expense to record your first transaction for this month."
        compact
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {transactions.map((transaction) => {
        const incoming = transaction.direction === 'in';
        const Icon = incoming ? CornerDownLeft : iconFor(transaction.category?.icon);
        return (
          <li key={transaction.id} className="flex items-center gap-3 px-5 py-2.5">
            <IconTile icon={Icon} size="sm" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-ink">
                {transaction.description || transaction.category?.name || 'Transaction'}
              </p>
              <p className="truncate text-sm text-muted">
                {incoming ? 'Repayment received' : (transaction.category?.name ?? 'Uncategorised')}
                {transaction.account && ` · ${transaction.account.name}`}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className={`tnum text-base font-medium ${incoming ? 'text-positive' : 'text-ink'}`}>
                {incoming ? '+' : '−'}
                {formatCurrency(transaction.amount, { currencySymbol: symbol })}
              </p>
              <p className="tnum text-sm text-muted">{formatDayMonth(transaction.date)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
