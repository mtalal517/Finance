import { Coins, PiggyBank, Receipt, TrendingUp } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { resolveMonth, type SearchParams } from '@/lib/server/month';
import { monthLabel, monthOf } from '@/lib/finance/dates';
import { enrichTransactions, getMonthSummary, sortByDateDesc } from '@/lib/finance/calculations';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { MonthNav } from '@/components/MonthNav';
import { ExpenseBrowser } from '@/components/expenses/ExpenseBrowser';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await readData();
  const month = resolveMonth(await searchParams, data.settings);
  const symbol = data.settings.currencySymbol;

  // Everything dated in this month, incoming rows included, so the list matches
  // what actually happened rather than only what was spent.
  const transactions = enrichTransactions(
    data,
    sortByDateDesc(data.expenses.filter((t) => monthOf(t.date) === month)),
  );
  const summary = getMonthSummary(data, month);

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle={`Every transaction in ${monthLabel(month)}`}
        actions={<MonthNav month={month} />}
      />

      <StatStrip className="mb-4">
        <StatItem label="Spent" amount={summary.expenses} symbol={symbol} icon={Receipt} />
        <StatItem label="Saved" amount={summary.savings} symbol={symbol} tone="positive" icon={PiggyBank} />
        <StatItem label="Invested" amount={summary.investments} symbol={symbol} icon={TrendingUp} />
        <StatItem
          label="Total out"
          amount={summary.outflow}
          symbol={symbol}
          icon={Coins}
          hint="Spending, savings and investments"
        />
      </StatStrip>

      <ExpenseBrowser transactions={transactions} symbol={symbol} />
    </>
  );
}
