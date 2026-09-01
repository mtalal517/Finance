import Link from 'next/link';
import { ArrowRight, ChartPie, Coins, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { resolveMonth, type SearchParams } from '@/lib/server/month';
import { monthLabel } from '@/lib/finance/dates';
import {
  getBudgetVsActual,
  getCategoryBreakdown,
  getInsights,
  getMonthSummary,
  getRecentTransactions,
  getSpendingComparison,
} from '@/lib/finance/calculations';
import { buildCategoryColors, OTHER_COLOR } from '@/lib/finance/chartPalette';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Primitives';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { MonthNav } from '@/components/MonthNav';
import { BudgetOverview } from '@/components/dashboard/BudgetOverview';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { MonthNotes } from '@/components/dashboard/MonthNotes';
import { CategoryDonut, type DonutSlice } from '@/components/charts/CategoryDonut';

export const dynamic = 'force-dynamic';

/** How many slices get their own colour before the tail folds into "Other". */
const MAX_SLICES = 7;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await readData();
  const month = resolveMonth(await searchParams, data.settings);
  const symbol = data.settings.currencySymbol;

  const summary = getMonthSummary(data, month);
  const budget = getBudgetVsActual(data, month);
  const breakdown = getCategoryBreakdown(data, month);
  const recent = getRecentTransactions(data, month, 7);
  const comparison = getSpendingComparison(data, month);
  const insights = getInsights(data, month).slice(0, 3);

  // Colours follow the user's category order, not this month's ranking, so a
  // category keeps its colour as you move between months.
  const head = breakdown.slice(0, MAX_SLICES);
  const tail = breakdown.slice(MAX_SLICES);
  const colors = buildCategoryColors(
    data.categories.map((c) => c.id),
    head.map((slice) => slice.category.id),
  );

  const slices: DonutSlice[] = head.map((slice) => ({
    id: slice.category.id,
    label: slice.category.name,
    icon: slice.category.icon,
    amount: slice.amount,
    percent: slice.percent,
    color: colors.get(slice.category.id) ?? OTHER_COLOR,
  }));

  if (tail.length > 0) {
    slices.push({
      id: '__other__',
      label: `Other (${tail.length})`,
      icon: 'package',
      amount: tail.reduce((total, slice) => total + slice.amount, 0),
      percent: tail.reduce((total, slice) => total + slice.percent, 0),
      color: OTHER_COLOR,
    });
  }

  const hasAnything = summary.income > 0 || summary.outflow > 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={monthLabel(month)} actions={<MonthNav month={month} />} />

      <StatStrip>
        <StatItem
          label="Income"
          amount={summary.income}
          symbol={symbol}
          icon={Wallet}
          hint={
            summary.incomeByType.salary > 0
              ? `${formatCurrency(summary.incomeByType.salary, { currencySymbol: symbol })} salary`
              : 'No salary recorded'
          }
        />
        <StatItem
          label="Expenses"
          amount={summary.expenses}
          symbol={symbol}
          icon={Receipt}
          hint={`${summary.expenseTransactionCount} transaction${summary.expenseTransactionCount === 1 ? '' : 's'}`}
        />
        <StatItem
          label="Savings"
          amount={summary.savings}
          symbol={symbol}
          tone={summary.savings > 0 ? 'positive' : 'default'}
          icon={PiggyBank}
          hint={summary.income > 0 ? `${formatPercent(summary.savingsRate, 0)} of income` : 'Set aside this month'}
        />
        <StatItem
          label="Invested"
          amount={summary.investments}
          symbol={symbol}
          icon={TrendingUp}
          hint="Moved into investments"
        />
        <StatItem
          label="Remaining"
          amount={summary.remaining}
          symbol={symbol}
          tone={summary.remaining < 0 ? 'danger' : 'default'}
          icon={Coins}
          hint={summary.remaining < 0 ? 'Spent past your income' : 'Not yet spent or set aside'}
        />
      </StatStrip>

      {!hasAnything ? (
        <Card className="mt-4">
          <EmptyState
            icon={ChartPie}
            title={`Nothing recorded for ${monthLabel(month)}`}
            body="Start with your income for the month, then record expenses as they happen. Every figure here is worked out from what you enter."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href={`/income?month=${month}`}
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-base font-medium text-white shadow-xs transition-colors hover:bg-primary-hover"
                >
                  Add income
                </Link>
                <Link
                  href={`/budget?month=${month}`}
                  className="inline-flex h-9 items-center rounded-lg border border-line-strong bg-surface px-3.5 text-base font-medium text-ink shadow-xs transition-colors hover:bg-sunken"
                >
                  Create a budget
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" padded={false}>
            <CardHeader
              title="Budget"
              subtitle="Select a category to see where the money went"
              border
              action={
                <Link
                  href={`/budget?month=${month}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-accent-ink"
                >
                  Manage
                  <ArrowRight size={13} strokeWidth={2} aria-hidden />
                </Link>
              }
            />
            <BudgetOverview rows={budget.expenseRows} month={month} symbol={symbol} />
          </Card>

          <Card>
            <CardHeader title="Where it went" subtitle="Spending only" />
            {slices.length > 0 ? (
              <CategoryDonut slices={slices} total={summary.expenses} symbol={symbol} />
            ) : (
              <EmptyState icon={ChartPie} title="No expenses yet" body="Record a few and the split appears here." compact />
            )}
          </Card>

          <Card className="lg:col-span-2" padded={false}>
            <CardHeader
              title="Recent activity"
              border
              action={
                <Link
                  href={`/expenses?month=${month}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-accent-ink"
                >
                  View all
                  <ArrowRight size={13} strokeWidth={2} aria-hidden />
                </Link>
              }
            />
            <RecentTransactions transactions={recent} symbol={symbol} />
          </Card>

          <Card>
            <CardHeader title="Spending vs last month" />
            <MonthNotes
              comparison={comparison}
              month={month}
              previousMonth={comparison.previousMonth}
              symbol={symbol}
              insights={insights}
            />
          </Card>
        </div>
      )}
    </>
  );
}
