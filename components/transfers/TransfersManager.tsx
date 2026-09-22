'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowRightLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppData } from '@/components/AppDataProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormError, SelectField, TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/Primitives';
import { apiRequest } from '@/lib/client/api';
import { formatDate, todayIso } from '@/lib/finance/dates';
import { formatCurrency } from '@/lib/finance/format';
import type { EnrichedTransfer } from '@/lib/finance/calculations';
import type { DateFormat, Transfer } from '@/lib/types';

/**
 * Money moved between two of your accounts, listed newest first.
 *
 * A transfer is neither income nor spending, so nothing here touches the
 * month's figures — only where the money sits, and which pot it belongs to.
 */

interface TransferValues {
  amount: string;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  categoryId: string;
  note: string;
}

function blankValues(): TransferValues {
  return { amount: '', date: todayIso(), fromAccountId: '', toAccountId: '', categoryId: '', note: '' };
}

function toValues(transfer: Transfer): TransferValues {
  return {
    amount: String(transfer.amount),
    date: transfer.date,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    categoryId: transfer.categoryId ?? '',
    note: transfer.note,
  };
}

export function TransfersManager({
  transfers,
  symbol,
  dateFormat,
}: {
  transfers: EnrichedTransfer[];
  symbol: string;
  dateFormat: DateFormat;
}) {
  const router = useRouter();
  const toast = useToast();
  const { accounts, categories } = useAppData();

  const [editing, setEditing] = useState<{ id?: string; values: TransferValues } | null>(null);
  const [deleting, setDeleting] = useState<EnrichedTransfer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function resetErrors() {
    setFormError(null);
    setFieldErrors({});
  }

  function openNew() {
    resetErrors();
    setEditing({ values: blankValues() });
  }

  function openEdit(transfer: Transfer) {
    resetErrors();
    setEditing({ id: transfer.id, values: toValues(transfer) });
  }

  function set<K extends keyof TransferValues>(key: K, value: TransferValues[K]) {
    if (!editing) return;
    setEditing({ ...editing, values: { ...editing.values, [key]: value } });
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
    resetErrors();

    const response = await apiRequest<{ transfer: Transfer }>(
      editing.id ? `/api/transfers/${editing.id}` : '/api/transfers',
      {
        method: editing.id ? 'PUT' : 'POST',
        body: { ...editing.values, categoryId: editing.values.categoryId || null },
      },
    );

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    const to = accounts.find((a) => a.id === response.transfer.toAccountId);
    toast.success(
      editing.id
        ? 'Transfer updated.'
        : `Moved ${formatCurrency(response.transfer.amount, { currencySymbol: symbol })} to ${to?.name ?? 'the account'}.`,
    );
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const response = await apiRequest(`/api/transfers/${deleting.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Transfer removed.');
    setDeleting(null);
    router.refresh();
  }

  const setAside = categories.filter((c) => c.type !== 'expense');
  const spending = categories.filter((c) => c.type === 'expense');

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={Plus} onClick={openNew} disabled={accounts.length < 2}>
          New transfer
        </Button>
      </div>

      <div className="surface overflow-hidden">
        {transfers.length === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title="No transfers yet"
            body={
              accounts.length < 2
                ? 'Add a second account first — a transfer needs somewhere to go.'
                : 'Move money between your accounts — bank to cash, or into a savings account — and say which pot it belongs to.'
            }
            action={
              accounts.length >= 2 ? (
                <Button variant="primary" icon={Plus} onClick={openNew}>
                  Record a transfer
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop */}
            <table className="hidden w-full text-left md:table">
              <thead>
                <tr className="table-head border-b border-line">
                  <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">From</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">To</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Note</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-5 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="group transition-colors hover:bg-sunken/50">
                    <td className="tnum px-5 py-2.5 whitespace-nowrap text-ink-soft">
                      {formatDate(transfer.date, dateFormat)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink">{transfer.from?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink">
                      <span className="flex items-center gap-1.5">
                        <ArrowRight size={14} strokeWidth={1.9} className="text-muted" aria-hidden />
                        {transfer.to?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{transfer.category?.name ?? 'Not set'}</td>
                    <td className="max-w-[16rem] px-3 py-2.5">
                      <p className="truncate text-ink-soft">{transfer.note || '—'}</p>
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-medium whitespace-nowrap text-ink">
                      {formatCurrency(transfer.amount, { currencySymbol: symbol })}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          icon={Pencil}
                          aria-label="Edit transfer"
                          onClick={() => openEdit(transfer)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          icon={Trash2}
                          aria-label="Delete transfer"
                          onClick={() => setDeleting(transfer)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile */}
            <ul className="divide-y divide-line md:hidden">
              {transfers.map((transfer) => (
                <li key={transfer.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-base font-medium text-ink">
                      {transfer.from?.name ?? '—'}
                      <ArrowRight size={14} strokeWidth={1.9} className="shrink-0 text-muted" aria-hidden />
                      {transfer.to?.name ?? '—'}
                    </p>
                    <p className="tnum truncate text-sm text-muted">
                      {formatDate(transfer.date, dateFormat)}
                      {` · ${transfer.category?.name ?? 'Not set'}`}
                      {transfer.note && ` · ${transfer.note}`}
                    </p>
                    <div className="mt-1.5 flex gap-0.5">
                      <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label="Edit transfer" onClick={() => openEdit(transfer)} />
                      <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Delete transfer" onClick={() => setDeleting(transfer)} />
                    </div>
                  </div>
                  <span className="tnum shrink-0 text-base font-medium text-ink">
                    {formatCurrency(transfer.amount, { currencySymbol: symbol })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit transfer' : 'New transfer'}
        description="Moves money between two of your accounts. It is not income or spending."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="transfer-form" variant="primary" loading={saving}>
              {editing?.id ? 'Save changes' : 'Move money'}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="transfer-form" onSubmit={save} noValidate className="space-y-4">
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                required
                prefix={symbol}
                placeholder="0"
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
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="From account"
                required
                value={editing.values.fromAccountId}
                error={fieldErrors.fromAccountId}
                onChange={(e) => set('fromAccountId', e.target.value)}
              >
                <option value="">Choose an account…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="To account"
                required
                value={editing.values.toAccountId}
                error={fieldErrors.toAccountId}
                onChange={(e) => set('toAccountId', e.target.value)}
              >
                <option value="">Choose an account…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id} disabled={account.id === editing.values.fromAccountId}>
                    {account.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <SelectField
              label="Category"
              value={editing.values.categoryId}
              error={fieldErrors.categoryId}
              hint="Which pot this money belongs to. It moves with the money."
              onChange={(e) => set('categoryId', e.target.value)}
            >
              <option value="">Not set</option>
              {setAside.length > 0 && (
                <optgroup label="Set aside">
                  {setAside.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {spending.length > 0 && (
                <optgroup label="Spending">
                  {spending.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </SelectField>
            <TextField
              label="Note"
              maxLength={200}
              placeholder="ATM withdrawal"
              value={editing.values.note}
              error={fieldErrors.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Remove this transfer?"
        body={
          deleting ? (
            <>
              <strong className="font-medium text-ink">
                {formatCurrency(deleting.amount, { currencySymbol: symbol })}
              </strong>{' '}
              goes back to {deleting.from?.name ?? 'the source account'}. Both accounts return to what they were before
              this transfer.
            </>
          ) : null
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
