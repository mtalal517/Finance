import { ArrowRightLeft, CalendarDays, Hash } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { enrichTransfers, getTransferOverview } from '@/lib/finance/calculations';
import { resolveMonth, type SearchParams } from '@/lib/server/month';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { TransfersManager } from '@/components/transfers/TransfersManager';

export const dynamic = 'force-dynamic';

export default async function TransfersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await readData();
  const symbol = data.settings.currencySymbol;
  const month = resolveMonth(await searchParams, data.settings);
  const overview = getTransferOverview(data, month);

  return (
    <>
      <PageHeader title="Transfers" subtitle="Money moved between your accounts" />

      <StatStrip className="mb-4">
        <StatItem label="Moved this month" amount={overview.movedThisMonth} symbol={symbol} icon={CalendarDays} />
        <StatItem label="Moved all time" amount={overview.movedAllTime} symbol={symbol} icon={ArrowRightLeft} />
        <StatItem label="Transfers" icon={Hash}>
          {overview.count}
        </StatItem>
      </StatStrip>

      <TransfersManager transfers={enrichTransfers(data)} symbol={symbol} dateFormat={data.settings.dateFormat} />
    </>
  );
}
