import { listBackups, readData } from '@/lib/data/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Primitives';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { CategorySettings } from '@/components/settings/CategorySettings';
import { DataSettings } from '@/components/settings/DataSettings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const data = await readData();
  const backups = await listBackups();

  // Counted here rather than in the browser, so the delete dialog can say
  // exactly what is at stake before anything is removed.
  const usage = data.categories.map((category) => ({
    id: category.id,
    transactions: data.expenses.filter((t) => t.categoryId === category.id).length,
    budgets: data.budgets.filter((b) => category.id in b.categories).length,
  }));

  return (
    <>
      <PageHeader title="Settings" subtitle="Preferences, categories and your data" />

      <div className="space-y-4">
        <Card>
          <CardHeader title="General" subtitle="How amounts and dates are shown" />
          <GeneralSettings settings={data.settings} />
        </Card>

        <Card>
          <CardHeader
            title="Categories"
            subtitle="Spending categories, plus the savings and investment buckets kept out of your spending totals"
          />
          <CategorySettings categories={data.categories} usage={usage} />
        </Card>

        <Card>
          <CardHeader title="Data" subtitle="Export, import and restore" />
          <DataSettings backups={backups} />
        </Card>
      </div>
    </>
  );
}
