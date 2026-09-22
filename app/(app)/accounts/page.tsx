import { ArrowDownLeft, ArrowUpRight, Coins } from 'lucide-react';
import { readData } from '@/lib/data/store';
import {
  getAccountActivity,
  getAccountBalances,
  getAccountContents,
  getTotalBalance,
  getUnassignedTotals,
} from '@/lib/finance/calculations';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { AccountsManager } from '@/components/accounts/AccountsManager';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const data = await readData();
  const symbol = data.settings.currencySymbol;

  const balances = getAccountBalances(data);
  const activity = getAccountActivity(data);
  const contents = getAccountContents(data);
  const total = getTotalBalance(data);
  const unassigned = getUnassignedTotals(data);

  const received = balances.reduce(
    (sum, b) => sum + b.incomeIn + b.receivedIn + b.addedIn + b.transferredIn,
    0,
  );
  const paidOut = balances.reduce((sum, b) => sum + b.paidOut + b.transferredOut, 0);

  return (
    <>
      <PageHeader title="Accounts" subtitle="Where your money actually sits" />

      <StatStrip className="mb-4">
        <StatItem
          label="Total balance"
          amount={total}
          symbol={symbol}
          tone={total < 0 ? 'danger' : 'positive'}
          icon={Coins}
          hint="Across every account"
        />
        <StatItem
          label="Money in"
          amount={received}
          symbol={symbol}
          icon={ArrowDownLeft}
          hint="Income, repayments, money added and transfers in"
        />
        <StatItem
          label="Money out"
          amount={paidOut}
          symbol={symbol}
          icon={ArrowUpRight}
          hint="Paid or transferred out of an account"
        />
      </StatStrip>

      <AccountsManager
        activity={activity}
        balances={balances}
        contents={contents}
        deposits={data.deposits}
        transfers={data.transfers}
        symbol={symbol}
        unassigned={unassigned}
      />
    </>
  );
}
