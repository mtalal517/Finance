'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormError, TextField } from '@/components/ui/Field';
import { DetailRow, EmptyState, IconTile } from '@/components/ui/Primitives';
import { IconPicker } from '@/components/ui/IconPicker';
import { apiRequest } from '@/lib/client/api';
import { iconFor } from '@/lib/icons/registry';
import { DEFAULT_ACCOUNT_ICON, type IconName } from '@/lib/icons/names';
import { formatCurrency } from '@/lib/finance/format';
import type { AccountBalance } from '@/lib/finance/calculations';
import type { Account } from '@/lib/types';

/**
 * Accounts and their balances.
 *
 * A balance is never typed in: it is the opening balance plus income received,
 * plus repayments received, minus everything paid out. The breakdown sits on
 * each card so the number is checkable rather than something to trust.
 */

interface AccountValues {
  name: string;
  icon: string;
  openingBalance: string;
}

export function AccountsManager({
  balances,
  symbol,
  unassigned,
}: {
  balances: AccountBalance[];
  symbol: string;
  unassigned: { income: number; spending: number };
}) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<{ id?: string; values: AccountValues } | null>(null);
  const [deleting, setDeleting] = useState<AccountBalance | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openAdd() {
    setFormError(null);
    setFieldErrors({});
    setEditing({ values: { name: '', icon: DEFAULT_ACCOUNT_ICON, openingBalance: '' } });
  }

  function openEdit(account: Account) {
    setFormError(null);
    setFieldErrors({});
    setEditing({
      id: account.id,
      values: { name: account.name, icon: account.icon, openingBalance: String(account.openingBalance) },
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const response = await apiRequest<{ account: Account }>(
      editing.id ? `/api/accounts/${editing.id}` : '/api/accounts',
      {
        method: editing.id ? 'PUT' : 'POST',
        body: { ...editing.values, openingBalance: editing.values.openingBalance || 0 },
      },
    );

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    toast.success(editing.id ? 'Account updated.' : 'Account added.');
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    // The account has history, so entries are kept and simply unlinked.
    const strategy = deleting.transactionCount > 0 ? '?strategy=unassign' : '';
    const response = await apiRequest(`/api/accounts/${deleting.account.id}${strategy}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Account deleted.');
    setDeleting(null);
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={Plus} onClick={openAdd}>
          Add account
        </Button>
      </div>

      {balances.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={CreditCard}
            title="No accounts"
            body="Add the places your money actually sits — a bank account, cash in hand, a wallet app — and expenses can be attributed to them."
            action={
              <Button variant="primary" icon={Plus} onClick={openAdd}>
                Add account
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((balance) => {
            const Icon = iconFor(balance.account.icon, DEFAULT_ACCOUNT_ICON);
            return (
              <div key={balance.account.id} className="surface group flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconTile icon={Icon} />
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-medium text-ink">{balance.account.name}</h3>
                      <p className="text-sm text-muted">
                        {balance.transactionCount} entr{balance.transactionCount === 1 ? 'y' : 'ies'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={Pencil}
                      aria-label={`Edit ${balance.account.name}`}
                      onClick={() => openEdit(balance.account)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={Trash2}
                      aria-label={`Delete ${balance.account.name}`}
                      onClick={() => setDeleting(balance)}
                    />
                  </div>
                </div>

                <p className={`tnum mt-4 text-xl font-semibold ${balance.currentBalance < 0 ? 'text-danger' : 'text-ink'}`}>
                  {formatCurrency(balance.currentBalance, { currencySymbol: symbol })}
                </p>
                <p className="label mt-0.5">Current balance</p>

                <dl className="mt-4 space-y-1.5 border-t border-line pt-3">
                  <DetailRow
                    label="Opening"
                    tone="muted"
                    value={formatCurrency(balance.openingBalance, { currencySymbol: symbol })}
                  />
                  <DetailRow
                    label="Income in"
                    tone="positive"
                    value={`+ ${formatCurrency(balance.incomeIn, { currencySymbol: symbol })}`}
                  />
                  {balance.receivedIn > 0 && (
                    <DetailRow
                      label="Repayments in"
                      tone="positive"
                      value={`+ ${formatCurrency(balance.receivedIn, { currencySymbol: symbol })}`}
                    />
                  )}
                  <DetailRow
                    label="Paid out"
                    tone="muted"
                    value={`− ${formatCurrency(balance.paidOut, { currencySymbol: symbol })}`}
                  />
                </dl>
              </div>
            );
          })}
        </div>
      )}

      {(unassigned.income > 0 || unassigned.spending > 0) && (
        <div className="surface mt-4 p-4">
          <p className="text-base font-medium text-ink">Not linked to any account</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {formatCurrency(unassigned.income, { currencySymbol: symbol })} of income and{' '}
            {formatCurrency(unassigned.spending, { currencySymbol: symbol })} of spending have no account set. They
            still count towards your totals and budgets — they just do not move a balance here.
          </p>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit account' : 'New account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="account-form" variant="primary" loading={saving}>
              {editing?.id ? 'Save changes' : 'Add account'}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="account-form" onSubmit={save} noValidate className="space-y-4">
            <FormError message={formError} />
            <TextField
              label="Name"
              required
              maxLength={60}
              placeholder="SadaPay"
              value={editing.values.name}
              error={fieldErrors.name}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, name: e.target.value } })}
            />
            <TextField
              label="Opening balance"
              type="number"
              step="0.01"
              prefix={symbol}
              placeholder="0"
              hint="What was in this account before you started tracking. Can be negative."
              value={editing.values.openingBalance}
              error={fieldErrors.openingBalance}
              onChange={(e) =>
                setEditing({ ...editing, values: { ...editing.values, openingBalance: e.target.value } })
              }
            />
            <IconPicker
              value={editing.values.icon}
              onChange={(icon: IconName) => setEditing({ ...editing, values: { ...editing.values, icon } })}
            />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this account?"
        body={
          deleting ? (
            deleting.transactionCount > 0 ? (
              <>
                <strong className="font-medium text-ink">{deleting.account.name}</strong> is used by{' '}
                {deleting.transactionCount} entr{deleting.transactionCount === 1 ? 'y' : 'ies'}. Those entries are kept
                and still count towards your spending and budgets — they simply stop being linked to an account.
              </>
            ) : (
              <>
                <strong className="font-medium text-ink">{deleting.account.name}</strong> will be removed. Nothing is
                using it.
              </>
            )
          ) : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
