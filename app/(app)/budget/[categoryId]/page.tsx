import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Minus, Receipt } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { resolveMonth, type SearchParams } from '@/lib/server/month';
import { addMonths, currentMonth, formatDate, monthLabel, todayIso } from '@/lib/finance/dates';
import { compare, enrichTransactions, getCategoryDetail } from '@/lib/finance/calculations';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import { iconFor } from '@/lib/icons/registry';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge, Card, CardHeader, DetailRow, EmptyState, IconTile, ProgressBar } from '@/components/ui/Primitives';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { MonthNav } from '@/components/MonthNav';
import { AddInCategoryButton } from '@/components/expenses/AddInCategoryButton';

export const dynamic = 'force-dynamic';

/**
 * The category drill-down — the page that answers "from my Transport budget,
 * what did I spend, how much, and on what date?".
 */
export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const data = await readData();
  const { categoryId } = await params;
  const month = resolveMonth(await searchParams, data.settings);
  const symbol = data.settings.currencySymbol;

  const detail = getCategoryDetail(data, month, categoryId);
  if (!detail) notFound();

  const transactions = enrichTransactions(data, detail.transactions);
  const previous = compare(detail.spent, detail.previousMonthSpent);
  const Icon = iconFor(detail.category.icon);

  const barTone = detail.status === 'over' ? 'danger' : detail.status === 'warning' ? 'warning' : 'positive';
  const TrendIcon =
    previous.direction === 'down' ? ArrowDownRight : previous.direction === 'up' ? ArrowUpRight : Minus;

  // Default a new expense to today when today falls inside the month on screen.
  const defaultDate = month === currentMonth() ? todayIso() : `${month}-01`;

  return (
    <>
      <PageHeader
        back={
          <Link
            href={`/budget?month=${month}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            Budget
          </Link>
        }
        title={detail.category.name}
        subtitle={monthLabel(month)}
        actions={
          <>
            <MonthNav month={month} />
            <AddInCategoryButton
              categoryId={detail.category.id}
              categoryName={detail.category.name}
              defaultDate={defaultDate}
            />
          </>
        }
      />

      <StatStrip className="mb-4">
        <StatItem label="Budget" icon={Icon}>
          {detail.budget > 0 ? (
            formatCurrency(detail.budget, { currencySymbol: symbol })
          ) : (
            <span className="text-base font-normal text-muted">Not budgeted</span>
          )}
        </StatItem>
        <StatItem label="Spent" amount={detail.spent} symbol={symbol} />
        <StatItem
          label="Left"
          tone={detail.budget > 0 && detail.remaining < 0 ? 'danger' : 'default'}
        >
          {detail.budget > 0 ? formatCurrency(detail.remaining, { currencySymbol: symbol }) : '—'}
        </StatItem>
        <StatItem label="Used" tone={detail.status === 'over' ? 'danger' : 'default'}>
          {detail.budget > 0 ? formatPercent(detail.percentUsed) : '—'}
        </StatItem>
      </StatStrip>

      {detail.budget > 0 && (
        <div className="surface mb-4 flex items-center gap-3 px-5 py-4">
          <ProgressBar
            percent={detail.percentUsed}
            tone={barTone}
            className="flex-1"
            label={`${detail.category.name} budget used`}
          />
          {detail.status === 'over' ? (
            <Badge tone="danger">
              Over by {formatCurrency(Math.abs(detail.remaining), { currencySymbol: symbol })}
            </Badge>
          ) : (
            <Badge tone={detail.status === 'warning' ? 'warning' : 'positive'}>
              {formatCurrency(detail.remaining, { currencySymbol: symbol })} left
            </Badge>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padded={false}>
          <CardHeader title="Transactions" subtitle={`Charged to ${detail.category.name} in ${monthLabel(month)}`} border />

          {transactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nothing spent here yet"
              body={`No ${detail.category.name.toLowerCase()} transactions in ${monthLabel(month)}. When you record one it appears here with its date and description.`}
              action={
                <AddInCategoryButton
                  categoryId={detail.category.id}
                  categoryName={detail.category.name}
                  defaultDate={defaultDate}
                />
              }
            />
          ) : (
            <>
              <table className="hidden w-full text-left sm:table">
                <thead>
                  <tr className="table-head border-b border-line">
                    <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Description</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Paid from</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="transition-colors hover:bg-sunken/50">
                      <td className="tnum px-5 py-2.5 whitespace-nowrap text-ink-soft">
                        {formatDate(transaction.date, data.settings.dateFormat)}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-ink">{transaction.description || '—'}</p>
                        {transaction.notes && <p className="text-sm text-muted">{transaction.notes}</p>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">
                        {transaction.account?.name ?? '—'}
                      </td>
                      <td className="tnum px-5 py-2.5 text-right font-medium whitespace-nowrap text-ink">
                        {formatCurrency(transaction.amount, { currencySymbol: symbol })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line">
                    <td colSpan={3} className="px-5 py-3 text-base font-medium text-ink-soft">
                      Total
                    </td>
                    <td className="tnum px-5 py-3 text-right text-base font-semibold text-ink">
                      {formatCurrency(detail.spent, { currencySymbol: symbol })}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <ul className="divide-y divide-line sm:hidden">
                {transactions.map((transaction) => (
                  <li key={transaction.id} className="flex items-start gap-3 px-4 py-3">
                    <IconTile icon={Icon} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base text-ink">{transaction.description || '—'}</p>
                      <p className="tnum truncate text-sm text-muted">
                        {formatDate(transaction.date, data.settings.dateFormat)}
                        {transaction.account && ` · ${transaction.account.name}`}
                      </p>
                    </div>
                    <span className="tnum shrink-0 text-base font-medium text-ink">
                      {formatCurrency(transaction.amount, { currencySymbol: symbol })}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between px-4 py-3">
                  <span className="text-base font-medium text-ink-soft">Total</span>
                  <span className="tnum text-base font-semibold text-ink">
                    {formatCurrency(detail.spent, { currencySymbol: symbol })}
                  </span>
                </li>
              </ul>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="At a glance" />
          <dl className="space-y-3">
            <DetailRow label="Transactions" value={String(detail.transactionCount)} />
            <DetailRow
              label="Average"
              value={formatCurrency(detail.averageTransaction, { currencySymbol: symbol })}
            />
            <DetailRow
              label="Largest"
              hint={detail.largest?.description || undefined}
              value={detail.largest ? formatCurrency(detail.largest.amount, { currencySymbol: symbol }) : '—'}
            />
          </dl>

          <div className="mt-5 border-t border-line pt-4">
            <p className="label mb-3">vs {monthLabel(addMonths(month, -1))}</p>
            <dl className="space-y-3">
              <DetailRow label={monthLabel(month)} value={formatCurrency(detail.spent, { currencySymbol: symbol })} />
              <DetailRow
                label={monthLabel(addMonths(month, -1))}
                tone="muted"
                value={formatCurrency(detail.previousMonthSpent, { currencySymbol: symbol })}
              />
            </dl>
            <p
              className={`mt-3 flex items-center gap-1.5 text-sm font-medium ${
                detail.previousMonthSpent === 0
                  ? 'text-muted'
                  : previous.direction === 'down'
                    ? 'text-positive'
                    : previous.direction === 'up'
                      ? 'text-warning'
                      : 'text-muted'
              }`}
            >
              {detail.previousMonthSpent === 0 ? (
                <span className="font-normal">Nothing spent here last month.</span>
              ) : (
                <>
                  <TrendIcon size={14} strokeWidth={2} aria-hidden />
                  {previous.direction === 'flat' ? (
                    <span>Exactly level with last month</span>
                  ) : (
                    <span>
                      {formatPercent(previous.percentChange, 0)} {previous.direction === 'down' ? 'less' : 'more'}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
