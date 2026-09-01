import { CalendarDays, Receipt, Sparkles, Wallet } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { resolveMonth, type SearchParams } from '@/lib/server/month';
import { monthLabel, yearOf } from '@/lib/finance/dates';
import { getMonthSummary, getYearSummary, incomeInMonth, sortByDateDesc } from '@/lib/finance/calculations';
import { formatCurrency } from '@/lib/finance/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { MonthNav } from '@/components/MonthNav';
import { IncomeManager } from '@/components/income/IncomeManager';

export const dynamic = 'force-dynamic';

export default async function IncomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await readData();
  const month = resolveMonth(await searchParams, data.settings);
  const symbol = data.settings.currencySymbol;

  const entries = sortByDateDesc(incomeInMonth(data, month));
  const summary = getMonthSummary(data, month);
  const year = getYearSummary(data, yearOf(month));

  return (
    <>
      <PageHeader
        title="Income"
        subtitle={`Everything that came in during ${monthLabel(month)}`}
        actions={<MonthNav month={month} />}
      />

      <StatStrip className="mb-4">
        <StatItem label="This month" amount={summary.income} symbol={symbol} tone="positive" icon={Wallet} />
        <StatItem
          label="Salary"
          amount={summary.incomeByType.salary}
          symbol={symbol}
          icon={Receipt}
          hint="Recorded per month, never assumed"
        />
        <StatItem
          label="Other income"
          amount={summary.income - summary.incomeByType.salary}
          symbol={symbol}
          icon={Sparkles}
          hint="Bonus, freelance and the rest"
        />
        <StatItem
          label={`${year.year} total`}
          amount={year.income}
          symbol={symbol}
          icon={CalendarDays}
          hint={
            year.monthsWithActivity > 0
              ? `${formatCurrency(year.averageMonthlyIncome, { currencySymbol: symbol }, { decimals: 0 })} a month`
              : 'No income yet this year'
          }
        />
      </StatStrip>

      <IncomeManager entries={entries} month={month} symbol={symbol} />
    </>
  );
}
