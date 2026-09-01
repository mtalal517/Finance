import { CalendarClock, Coins, Repeat, Wallet } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { getSubscriptionOverview } from '@/lib/finance/calculations';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { SubscriptionsManager } from '@/components/subscriptions/SubscriptionsManager';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const data = await readData();
  const symbol = data.settings.currencySymbol;
  const overview = getSubscriptionOverview(data);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="What charges you on a schedule, and what falls due next"
      />

      <StatStrip className="mb-4">
        <StatItem
          label="Every month"
          amount={overview.monthlyTotal}
          symbol={symbol}
          icon={Repeat}
          hint="Quarterly and yearly plans spread over the months they cover"
        />
        <StatItem
          label="Every year"
          amount={overview.yearlyTotal}
          symbol={symbol}
          icon={Coins}
          hint="What the active list costs over twelve months"
        />
        <StatItem
          label="Active"
          symbol={symbol}
          icon={Wallet}
          hint={
            overview.rows.length > overview.activeCount
              ? `${overview.rows.length - overview.activeCount} paused`
              : 'All of them running'
          }
        >
          {overview.activeCount}
        </StatItem>
        <StatItem
          label="Needs paying"
          icon={CalendarClock}
          tone={overview.dueSoonCount > 0 ? 'warning' : 'default'}
          hint={overview.dueSoonCount > 0 ? 'Due now or within the week' : 'Nothing due this week'}
        >
          {overview.dueSoonCount}
        </StatItem>
      </StatStrip>

      <SubscriptionsManager rows={overview.rows} symbol={symbol} />
    </>
  );
}
