import Link from 'next/link';
import { ChartColumn, Lightbulb, ListFilter } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { param, resolveMonth, type SearchParams } from '@/lib/server/month';
import { monthLabel, yearOf } from '@/lib/finance/dates';
import {
  getCategoryBreakdown,
  getInsights,
  getMonthSummary,
  getTrailingSeries,
  getYearSummary,
} from '@/lib/finance/calculations';
import { SERIES } from '@/lib/finance/chartPalette';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Primitives';
import { MonthNav } from '@/components/MonthNav';
import { CategoryRankBars, MonthlyBars, MonthlyLine } from '@/components/charts/TrendCharts';

export const dynamic = 'force-dynamic';

const RANGES = [6, 12] as const;

const INSIGHT_DOTS = {
  positive: 'bg-positive',
  warning: 'bg-warning',
  negative: 'bg-danger',
  neutral: 'bg-line-strong',
} as const;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolved = await searchParams;
  const data = await readData();
  const month = resolveMonth(resolved, data.settings);
  const symbol = data.settings.currencySymbol;

  const requestedRange = Number(param(resolved, 'range'));
  const range = RANGES.includes(requestedRange as 6 | 12) ? (requestedRange as 6 | 12) : 6;

  const series = getTrailingSeries(data, month, range);
  const year = getYearSummary(data, yearOf(month));
  const summary = getMonthSummary(data, month);
  const breakdown = getCategoryBreakdown(data, month, { include: ['expense', 'savings', 'investment'] });
  const insights = getInsights(data, month);

  const hasHistory = series.some((point) => point.income > 0 || point.expenses > 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Trends up to ${monthLabel(month)}`}
        actions={<MonthNav month={month} />}
      />

      {!hasHistory ? (
        <Card>
          <EmptyState
            icon={ChartColumn}
            title="Not enough history yet"
            body="Once you have recorded income and expenses across a couple of months, the trends, comparisons and insights appear here."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-xs">
            {RANGES.map((option) => (
              <Link
                key={option}
                href={`/analytics?month=${month}&range=${option}`}
                aria-current={option === range ? 'true' : undefined}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  option === range ? 'bg-sunken text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {option} months
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Money in and out" subtitle="Income against what you actually spent" />
              <MonthlyBars
                data={series}
                symbol={symbol}
                series={[
                  { key: 'income', name: 'Income', color: SERIES.income },
                  { key: 'expenses', name: 'Expenses', color: SERIES.expenses },
                ]}
              />
            </Card>

            <Card>
              <CardHeader title="Savings and investments" subtitle="Money kept rather than consumed" />
              <MonthlyLine
                data={series}
                symbol={symbol}
                series={[
                  { key: 'savings', name: 'Savings', color: SERIES.savings },
                  { key: 'investments', name: 'Investments', color: SERIES.investments },
                ]}
              />
            </Card>

            <Card>
              <CardHeader title="Monthly spending" subtitle="Expenses only, month by month" />
              <MonthlyBars
                data={series}
                symbol={symbol}
                series={[{ key: 'expenses', name: 'Expenses', color: SERIES.expenses }]}
              />
            </Card>

            <Card>
              <CardHeader
                title={`Where it went in ${monthLabel(month)}`}
                subtitle="Largest first, including what you set aside"
              />
              {breakdown.length === 0 ? (
                <EmptyState
                  icon={ListFilter}
                  title="Nothing recorded this month"
                  body="Pick another month to see its split."
                  compact
                />
              ) : (
                <CategoryRankBars
                  symbol={symbol}
                  rows={breakdown.map((slice) => ({
                    id: slice.category.id,
                    label: slice.category.name,
                    icon: slice.category.icon,
                    amount: slice.amount,
                  }))}
                />
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title={`${year.year} so far`}
                subtitle={`${year.monthsWithActivity} month${year.monthsWithActivity === 1 ? '' : 's'} with activity`}
              />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                <YearFigure label="Income" value={formatCurrency(year.income, { currencySymbol: symbol })} />
                <YearFigure label="Expenses" value={formatCurrency(year.expenses, { currencySymbol: symbol })} />
                <YearFigure
                  label="Savings"
                  value={formatCurrency(year.savings, { currencySymbol: symbol })}
                  tone="positive"
                />
                <YearFigure label="Investment" value={formatCurrency(year.investments, { currencySymbol: symbol })} />

                <YearFigure
                  label="Average income"
                  value={formatCurrency(year.averageMonthlyIncome, { currencySymbol: symbol }, { decimals: 0 })}
                />
                <YearFigure
                  label="Average expense"
                  value={formatCurrency(year.averageMonthlyExpense, { currencySymbol: symbol }, { decimals: 0 })}
                />
                <YearFigure
                  label="Unallocated"
                  value={formatCurrency(year.net, { currencySymbol: symbol })}
                  tone={year.net < 0 ? 'danger' : 'default'}
                />
                <YearFigure
                  label="Savings rate"
                  value={summary.income > 0 ? formatPercent(summary.savingsRate, 0) : '—'}
                />
              </dl>
            </Card>

            <Card>
              <CardHeader title="Insights" subtitle="From your own numbers" />
              {insights.length === 0 ? (
                <EmptyState
                  icon={Lightbulb}
                  title="Nothing to note yet"
                  body="Record a little more and observations appear here."
                  compact
                />
              ) : (
                <ul className="space-y-3">
                  {insights.map((insight) => (
                    <li key={insight.id} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${INSIGHT_DOTS[insight.tone]}`} />
                      {insight.text}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function YearFigure({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'danger';
}) {
  const tones = { default: 'text-ink', positive: 'text-positive', danger: 'text-danger' } as const;
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={`tnum mt-1 text-base font-semibold ${tones[tone]}`}>{value}</dd>
    </div>
  );
}
