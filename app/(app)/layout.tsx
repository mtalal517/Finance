import { readData } from '@/lib/data/store';
import { getAuthMode } from '@/lib/auth/session';
import { AppDataProvider } from '@/components/AppDataProvider';
import { ExpenseModalProvider } from '@/components/expenses/ExpenseModalProvider';
import { AppShell } from '@/components/layout/AppShell';
import { SetupNotice } from '@/components/layout/SetupNotice';

/** Data is read per request from the database, so nothing here may be cached. */
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Caught here rather than left to the error boundary: "no database" is a
  // setup step with one clear answer, not an unexpected failure.
  if (!process.env.MONGODB_URI?.trim()) return <SetupNotice />;

  const data = await readData();

  return (
    <AppDataProvider
      value={{
        settings: data.settings,
        categories: data.categories,
        accounts: data.accounts,
        debts: data.debts,
      }}
    >
      <ExpenseModalProvider>
        <AppShell showSignOut={getAuthMode().kind === 'password'}>{children}</AppShell>
      </ExpenseModalProvider>
    </AppDataProvider>
  );
}
