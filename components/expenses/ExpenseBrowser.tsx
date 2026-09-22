'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Pencil, Plus, Receipt, Search, SearchX, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useAppData } from '@/components/AppDataProvider';
import { useExpenseModal } from '@/components/expenses/ExpenseModalProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge, EmptyState, IconTile } from '@/components/ui/Primitives';
import { apiRequest } from '@/lib/client/api';
import { iconFor } from '@/lib/icons/registry';
import { formatDate } from '@/lib/finance/dates';
import { formatCurrency } from '@/lib/finance/format';
import type { EnrichedTransaction } from '@/lib/finance/calculations';

/**
 * The transaction list and its filters.
 *
 * Filtering happens in the browser over the month already loaded, so typing in
 * the search box is instant and never hits the database. The month itself stays
 * in the URL, because it is the one filter worth keeping when you move page.
 */

interface Filters {
  search: string;
  categoryId: string;
  accountId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { search: '', categoryId: '', accountId: '', from: '', to: '' };

export function ExpenseBrowser({
  transactions,
  symbol,
}: {
  transactions: EnrichedTransaction[];
  symbol: string;
}) {
  const { categories, accounts, settings } = useAppData();
  const { addExpense, editExpense } = useExpenseModal();
  const router = useRouter();
  const toast = useToast();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [deleting, setDeleting] = useState<EnrichedTransaction | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
      if (filters.accountId && (t.accountId ?? '') !== filters.accountId) return false;
      if (filters.from && t.date < filters.from) return false;
      if (filters.to && t.date > filters.to) return false;
      if (needle) {
        const haystack = [t.description, t.notes, t.category?.name, t.account?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [transactions, filters]);

  const total = useMemo(
    () => filtered.reduce((sum, t) => sum + (t.direction === 'in' ? -t.amount : t.amount), 0),
    [filtered],
  );

  const activeFilterCount = Object.values(filters).filter((value) => value !== '').length;

  async function confirmDelete() {
    if (!deleting) return;
    const response = await apiRequest(`/api/expenses/${deleting.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Transaction deleted.');
    setDeleting(null);
    router.refresh();
  }

  function set<K extends keyof Filters>(key: K, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const selectClass = 'field cursor-pointer appearance-none pr-7';

  return (
    <>
      <div className="surface mb-4 p-3">
        <div className="mb-2 flex gap-2 lg:hidden">
          <div className="relative flex-1">
            <Search size={14} strokeWidth={2} aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className="field pl-8"
              placeholder="Search…"
              aria-label="Search transactions"
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
            />
          </div>
          {/* Four more controls stacked would fill a phone screen, so they
              stay behind a toggle until they are wanted. */}
          <Button
            variant="secondary"
            icon={SlidersHorizontal}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="tnum ml-0.5 rounded-full bg-primary px-1.5 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <div
          className={`${filtersOpen ? 'grid' : 'hidden'} gap-2 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]`}
        >
          <div className="relative hidden lg:block">
            <Search size={14} strokeWidth={2} aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className="field pl-8"
              placeholder="Search description, notes…"
              aria-label="Search transactions"
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
            />
          </div>

          <select
            className={selectClass}
            aria-label="Filter by category"
            value={filters.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            aria-label="Filter by account"
            value={filters.accountId}
            onChange={(e) => set('accountId', e.target.value)}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="field"
            aria-label="From date"
            value={filters.from}
            onChange={(e) => set('from', e.target.value)}
          />
          <input
            type="date"
            className="field"
            aria-label="To date"
            value={filters.to}
            onChange={(e) => set('to', e.target.value)}
          />

          <Button
            variant="ghost"
            icon={X}
            onClick={() => setFilters(EMPTY_FILTERS)}
            disabled={activeFilterCount === 0}
            className="justify-self-start"
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">{filtered.length}</span>
            {filtered.length !== transactions.length && <> of {transactions.length}</>} transaction
            {filtered.length === 1 ? '' : 's'}
          </p>
          <p className="tnum text-sm text-muted">
            Net out <span className="font-medium text-ink">{formatCurrency(total, { currencySymbol: symbol })}</span>
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={transactions.length === 0 ? Receipt : SearchX}
            title={transactions.length === 0 ? 'No transactions this month' : 'Nothing matches those filters'}
            body={
              transactions.length === 0
                ? 'Record what you spend as it happens and it will all show up here, ready to search and filter.'
                : 'Try widening the date range or clearing a filter.'
            }
            action={
              transactions.length === 0 ? (
                <Button variant="primary" icon={Plus} onClick={() => addExpense()}>
                  Add expense
                </Button>
              ) : (
                <Button variant="secondary" icon={X} onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop */}
            <table className="hidden w-full text-left md:table">
              <thead>
                <tr className="table-head border-b border-line">
                  <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Description</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Account</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-5 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((transaction) => {
                  const incoming = transaction.direction === 'in';
                  const Icon = incoming ? CornerDownLeft : iconFor(transaction.category?.icon);
                  return (
                    <tr key={transaction.id} className="group transition-colors hover:bg-sunken/50">
                      <td className="tnum px-5 py-2.5 whitespace-nowrap text-ink-soft">
                        {formatDate(transaction.date, settings.dateFormat)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {incoming ? (
                          <Badge tone="positive">Money in</Badge>
                        ) : (
                          <span className="flex items-center gap-1.5 text-ink-soft">
                            <Icon size={14} strokeWidth={1.9} className="text-muted" aria-hidden />
                            {transaction.category?.name ?? 'Uncategorised'}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[18rem] px-3 py-2.5">
                        <p className="truncate text-ink">{transaction.description || '—'}</p>
                        {transaction.goal && (
                          <p className="truncate text-sm text-muted">From {transaction.goal.name} goal</p>
                        )}
                        {transaction.notes && (
                          <p className="truncate text-sm text-muted" title={transaction.notes}>
                            {transaction.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">
                        {transaction.account?.name ?? '—'}
                      </td>
                      <td
                        className={`tnum px-3 py-2.5 text-right font-medium whitespace-nowrap ${
                          incoming ? 'text-positive' : 'text-ink'
                        }`}
                      >
                        {incoming ? '+' : '−'}
                        {formatCurrency(transaction.amount, { currencySymbol: symbol })}
                      </td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          {/* A repayment is edited from the Debts page, where its link is visible. */}
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            icon={Pencil}
                            aria-label="Edit transaction"
                            onClick={() => editExpense(transaction)}
                            disabled={incoming}
                            title={incoming ? 'Repayments are managed from the Debts page' : undefined}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            icon={Trash2}
                            aria-label="Delete transaction"
                            onClick={() => setDeleting(transaction)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile */}
            <ul className="divide-y divide-line md:hidden">
              {filtered.map((transaction) => {
                const incoming = transaction.direction === 'in';
                const Icon = incoming ? CornerDownLeft : iconFor(transaction.category?.icon);
                return (
                  <li key={transaction.id} className="flex items-start gap-3 px-4 py-3">
                    <IconTile icon={Icon} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-ink">
                        {transaction.description || transaction.category?.name || 'Transaction'}
                      </p>
                      <p className="tnum truncate text-sm text-muted">
                        {formatDate(transaction.date, settings.dateFormat)}
                        {transaction.account && ` · ${transaction.account.name}`}
                        {transaction.goal && ` · from ${transaction.goal.name}`}
                      </p>
                      <div className="mt-1.5 flex gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          icon={Pencil}
                          aria-label="Edit transaction"
                          onClick={() => editExpense(transaction)}
                          disabled={incoming}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          icon={Trash2}
                          aria-label="Delete transaction"
                          onClick={() => setDeleting(transaction)}
                        />
                      </div>
                    </div>
                    <span
                      className={`tnum shrink-0 text-base font-medium ${incoming ? 'text-positive' : 'text-ink'}`}
                    >
                      {incoming ? '+' : '−'}
                      {formatCurrency(transaction.amount, { currencySymbol: symbol })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this transaction?"
        body={
          deleting ? (
            <>
              <strong className="font-medium text-ink">
                {formatCurrency(deleting.amount, { currencySymbol: symbol })}
              </strong>{' '}
              {deleting.description ? `for “${deleting.description}” ` : ''}
              on {formatDate(deleting.date, settings.dateFormat)} will be removed. Budgets, balances and analytics will
              be recalculated.
              {deleting.debtId && ' This is a debt repayment — the debt will show as unpaid again.'}
            </>
          ) : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
