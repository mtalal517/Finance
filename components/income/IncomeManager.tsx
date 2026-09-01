'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useAppData } from '@/components/AppDataProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormError, SelectField, TextField } from '@/components/ui/Field';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { apiRequest } from '@/lib/client/api';
import { formatDate, todayIso } from '@/lib/finance/dates';
import { formatCurrency } from '@/lib/finance/format';
import type { IncomeEntry, IncomeType } from '@/lib/types';

/**
 * The income table and its add/edit dialog.
 *
 * Salary is not special-cased: it is an income row dated inside a month, so a
 * month with two paycheques, a raise, or no salary at all needs no extra
 * machinery.
 */

const TYPE_LABELS: Record<IncomeType, string> = {
  salary: 'Salary',
  bonus: 'Bonus',
  freelance: 'Freelance',
  other: 'Other',
};

interface FormValues {
  amount: string;
  date: string;
  type: IncomeType;
  description: string;
  accountId: string;
}

function blankValues(month: string): FormValues {
  const today = todayIso();
  return {
    amount: '',
    // Default to the 1st of the month on screen, which is when salary lands.
    date: today.startsWith(month) ? today : `${month}-01`,
    type: 'salary',
    description: '',
    accountId: '',
  };
}

export function IncomeManager({
  entries,
  month,
  symbol,
}: {
  entries: IncomeEntry[];
  month: string;
  symbol: string;
}) {
  const { accounts, settings } = useAppData();
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<{ id?: string; values: FormValues } | null>(null);
  const [deleting, setDeleting] = useState<IncomeEntry | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setFieldErrors({});
    setFormError(null);
    setEditing({ values: blankValues(month) });
  }

  function openEdit(entry: IncomeEntry) {
    setFieldErrors({});
    setFormError(null);
    setEditing({
      id: entry.id,
      values: {
        amount: String(entry.amount),
        date: entry.date,
        type: entry.type,
        description: entry.description,
        accountId: entry.accountId ?? '',
      },
    });
  }

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setEditing((current) => (current ? { ...current, values: { ...current.values, [key]: value } } : current));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const response = await apiRequest<{ entry: IncomeEntry }>(
      editing.id ? `/api/income/${editing.id}` : '/api/income',
      {
        method: editing.id ? 'PUT' : 'POST',
        body: { ...editing.values, accountId: editing.values.accountId || null },
      },
    );

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    toast.success(editing.id ? 'Income updated.' : 'Income added.');
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const response = await apiRequest(`/api/income/${deleting.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Income deleted.');
    setDeleting(null);
    router.refresh();
  }

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  return (
    <>
      <div className="surface" >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">
            Entries
            <span className="ml-2 font-normal text-muted">{entries.length}</span>
          </h2>
          <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>
            Add income
          </Button>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No income this month"
            body="Add your salary here. Each month is recorded separately, so a raise or a bonus month is handled naturally."
            action={
              <Button variant="primary" icon={Plus} onClick={openAdd}>
                Add income
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop: a table. */}
            <table className="hidden w-full text-left md:table">
              <thead>
                <tr className="table-head border-b border-line">
                  <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Description</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Account</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-5 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((entry) => (
                  <tr key={entry.id} className="group transition-colors hover:bg-sunken/50">
                    <td className="tnum px-5 py-2.5 whitespace-nowrap text-ink-soft">
                      {formatDate(entry.date, settings.dateFormat)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge tone={entry.type === 'salary' ? 'accent' : 'neutral'}>{TYPE_LABELS[entry.type]}</Badge>
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-2.5 text-ink">{entry.description || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">
                      {accountName(entry.accountId) ?? '—'}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-medium whitespace-nowrap text-positive">
                      +{formatCurrency(entry.amount, { currencySymbol: symbol })}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label={`Edit income of ${entry.amount}`} onClick={() => openEdit(entry)} />
                        <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Delete income of ${entry.amount}`} onClick={() => setDeleting(entry)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: a list, reorganised rather than squeezed. */}
            <ul className="divide-y divide-line md:hidden">
              {entries.map((entry) => (
                <li key={entry.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-ink">
                        {entry.description || TYPE_LABELS[entry.type]}
                      </p>
                      <p className="tnum mt-0.5 text-sm text-muted">
                        {formatDate(entry.date, settings.dateFormat)}
                        {accountName(entry.accountId) && ` · ${accountName(entry.accountId)}`}
                      </p>
                    </div>
                    <span className="tnum shrink-0 text-base font-medium text-positive">
                      +{formatCurrency(entry.amount, { currencySymbol: symbol })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={entry.type === 'salary' ? 'accent' : 'neutral'}>{TYPE_LABELS[entry.type]}</Badge>
                    <div className="ml-auto flex gap-0.5">
                      <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label="Edit" onClick={() => openEdit(entry)} />
                      <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Delete" onClick={() => setDeleting(entry)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit income' : 'Add income'}
        description="The month this belongs to comes from the date you choose."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="income-form" variant="primary" loading={saving}>
              {editing?.id ? 'Save changes' : 'Add income'}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="income-form" onSubmit={save} noValidate className="space-y-4">
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                prefix={symbol}
                placeholder="0"
                autoComplete="off"
                value={editing.values.amount}
                error={fieldErrors.amount}
                onChange={(e) => set('amount', e.target.value)}
              />
              <TextField
                label="Date"
                type="date"
                required
                value={editing.values.date}
                error={fieldErrors.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
            <SelectField
              label="Type"
              required
              value={editing.values.type}
              error={fieldErrors.type}
              onChange={(e) => set('type', e.target.value as IncomeType)}
            >
              {(Object.keys(TYPE_LABELS) as IncomeType[]).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Description"
              placeholder="September salary"
              maxLength={200}
              autoComplete="off"
              value={editing.values.description}
              error={fieldErrors.description}
              onChange={(e) => set('description', e.target.value)}
            />
            <SelectField
              label="Received into"
              value={editing.values.accountId}
              error={fieldErrors.accountId}
              hint="Choose an account and this income counts towards its balance."
              onChange={(e) => set('accountId', e.target.value)}
            >
              <option value="">Not specified</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectField>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this income?"
        body={
          deleting ? (
            <>
              <strong className="font-medium text-ink">
                {formatCurrency(deleting.amount, { currencySymbol: symbol })}
              </strong>{' '}
              recorded on {formatDate(deleting.date, settings.dateFormat)} will be removed, and your budget and savings
              figures for the month recalculated.
            </>
          ) : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
