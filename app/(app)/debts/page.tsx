import { AlertTriangle, HandCoins, Handshake, Scale } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { getDebtOverview } from '@/lib/finance/calculations';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { DebtsManager } from '@/components/debts/DebtsManager';

export const dynamic = 'force-dynamic';

export default async function DebtsPage() {
  const data = await readData();
  const symbol = data.settings.currencySymbol;
  const overview = getDebtOverview(data);

  return (
    <>
      <PageHeader title="Debts" subtitle="What you owe, and what you are owed" />

      <StatStrip className="mb-6">
        <StatItem
          label="You owe"
          amount={overview.totalOwed}
          symbol={symbol}
          tone={overview.totalOwed > 0 ? 'danger' : 'default'}
          icon={HandCoins}
        />
        <StatItem
          label="Owed to you"
          amount={overview.totalOwedToYou}
          symbol={symbol}
          tone={overview.totalOwedToYou > 0 ? 'positive' : 'default'}
          icon={Handshake}
        />
        <StatItem
          label="Net position"
          amount={overview.net}
          symbol={symbol}
          tone={overview.net < 0 ? 'danger' : 'default'}
          icon={Scale}
          hint={overview.net < 0 ? 'You owe more than you are owed' : 'You are owed more than you owe'}
        />
        <StatItem
          label="Overdue"
          icon={AlertTriangle}
          tone={overview.overdueCount > 0 ? 'danger' : 'default'}
          hint={overview.overdueCount === 0 ? 'Nothing past its due date' : 'Past the agreed due date'}
        >
          {overview.overdueCount}
        </StatItem>
      </StatStrip>

      <DebtsManager overview={overview} symbol={symbol} dateFormat={data.settings.dateFormat} />
    </>
  );
}
