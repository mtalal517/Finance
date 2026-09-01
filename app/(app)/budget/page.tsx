import { Coins, Pin, Receipt, Wallet } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { resolveMonth, type SearchParams } from '@/lib/server/month';
import { addMonths, monthLabel } from '@/lib/finance/dates';
import { budgetForMonth, getBudgetVsActual, getMonthSummary } from '@/lib/finance/calculations';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Primitives';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { MonthNav } from '@/components/MonthNav';
import { BudgetEditor } from '@/components/budget/BudgetEditor';
import { BudgetVsActualTable } from '@/components/budget/BudgetVsActualTable';

export const dynamic = 'force-dynamic';

export default async function BudgetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await readData();
  const month = resolveMonth(await searchParams, data.settings);
  const symbol = data.settings.currencySymbol;

  const summary = getMonthSummary(data, month);
  const overview = getBudgetVsActual(data, month);
  const allocations = budgetForMonth(data, month);

  const previousMonth = addMonths(month, -1);
  const canCopyPrevious =
    Object.keys(allocations).length === 0 && Object.keys(budgetForMonth(data, previousMonth)).length > 0;

  return (
    <>
      <PageHeader
        title="Budget"
        subtitle={`Plan and track ${monthLabel(month)}`}
        actions={<MonthNav month={month} />}
      />

      <StatStrip className="mb-4">
        <StatItem label="Income" amount={summary.income} symbol={symbol} icon={Wallet} hint="What you have to work with" />
        <StatItem label="Allocated" amount={overview.totalAllocated} symbol={symbol} icon={Pin} />
        <StatItem
          label="Unallocated"
          amount={overview.unallocated}
          symbol={symbol}
          tone={overview.unallocated < 0 ? 'danger' : 'default'}
          icon={Coins}
          hint={overview.unallocated < 0 ? 'Allocated beyond your income' : 'Not yet assigned'}
        />
        <StatItem label="Spent so far" amount={overview.totalSpent} symbol={symbol} icon={Receipt} />
      </StatStrip>

      <Card>
        <CardHeader
          title="Allocations"
          subtitle="Decide how much each category gets. Leave one blank to leave it unbudgeted."
        />
        <BudgetEditor
          // Remounting on month change keeps the inputs in step with the month.
          key={month}
          month={month}
          allocations={allocations}
          income={summary.income}
          symbol={symbol}
          canCopyPrevious={canCopyPrevious}
        />
      </Card>

      <Card className="mt-4" padded={false}>
        <CardHeader
          title="Budget vs actual"
          subtitle="Worked out from your transactions — select a category to see where the money went"
          border
        />
        <BudgetVsActualTable rows={overview.rows} month={month} symbol={symbol} />
      </Card>
    </>
  );
}
