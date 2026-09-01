import { Flag, Target, TrendingUp } from 'lucide-react';
import { readData } from '@/lib/data/store';
import { getGoalsProgress } from '@/lib/finance/calculations';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatItem, StatStrip } from '@/components/ui/StatCard';
import { GoalsManager } from '@/components/goals/GoalsManager';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const data = await readData();
  const symbol = data.settings.currencySymbol;

  const goals = getGoalsProgress(data).sort((a, b) => {
    // Finished goals sink to the bottom; the rest lead with the nearest deadline.
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
    return (a.goal.targetDate ?? '9999-12-31').localeCompare(b.goal.targetDate ?? '9999-12-31');
  });

  const saved = goals.reduce((total, goal) => total + goal.currentAmount, 0);
  const targeted = goals.reduce((total, goal) => total + goal.targetAmount, 0);
  const completed = goals.filter((goal) => goal.isComplete).length;

  return (
    <>
      <PageHeader title="Goals" subtitle="What you are putting money aside for" />

      {goals.length > 0 && (
        <StatStrip className="mb-4">
          <StatItem label="Saved towards goals" amount={saved} symbol={symbol} tone="positive" icon={Target} />
          <StatItem label="Combined target" amount={targeted} symbol={symbol} icon={Flag} />
          <StatItem label="Still to go" amount={Math.max(0, targeted - saved)} symbol={symbol} icon={TrendingUp} />
          <StatItem label="Reached">
            {completed}
            <span className="ml-1.5 text-base font-normal text-muted">of {goals.length}</span>
          </StatItem>
        </StatStrip>
      )}

      <GoalsManager goals={goals} symbol={symbol} dateFormat={data.settings.dateFormat} />
    </>
  );
}
