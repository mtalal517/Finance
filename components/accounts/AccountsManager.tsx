'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppData } from '@/components/AppDataProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormError, SelectField, TextField } from '@/components/ui/Field';
import { DetailRow, EmptyState, IconTile } from '@/components/ui/Primitives';
import { IconPicker } from '@/components/ui/IconPicker';
import { apiRequest } from '@/lib/client/api';
import { iconFor } from '@/lib/icons/registry';
import { DEFAULT_ACCOUNT_ICON, type IconName } from '@/lib/icons/names';
import { formatDate, todayIso } from '@/lib/finance/dates';
import { formatCurrency } from '@/lib/finance/format';
import type {
  AccountActivity,
  AccountBalance,
  AccountContents,
  AccountEntry,
  AccountEntryKind,
} from '@/lib/finance/calculations';
import type { Account, Deposit } from '@/lib/types';

/**
 * Accounts and their balances.
 *
 * A balance is never typed in: it is the opening balance plus income received,
 * plus repayments received, plus money added, minus everything paid out. The
 * breakdown sits on each card so the number is checkable rather than something
 * to trust.
 *
 * "Add money" is the one way to put money somewhere without earning it. An
 * entry may name the category or savings pot it is for, which is what lets a
 * card say not just how much is in an account but what it is for; saying so is
 * optional, because often all you know is that the money arrived.
 *
 * Clicking a card opens everything that has moved through that account —
 * income, spending, repayments and money added — in one list.
 */

interface AccountValues {
  name: string;
  icon: string;
  openingBalance: string;
}

interface DepositValues {
  amount: string;
  categoryId: string;
  date: string;
  note: string;
}

const KIND_LABELS: Record<AccountEntryKind, string> = {
  income: 'Income',
  spending: 'Spending',
  repayment: 'Repayment',
  added: 'Money added',
  transfer: 'Transfer',
};

export function AccountsManager({
  activity,
  balances,
  contents,
  deposits,
  symbol,
  unassigned,
}: {
  activity: AccountActivity[];
  balances: AccountBalance[];
  contents: AccountContents[];
  deposits: Deposit[];
  symbol: string;
  unassigned: { income: number; spending: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const { categories, settings } = useAppData();

  const spending = categories.filter((c) => c.type === 'expense');
  const setAside = categories.filter((c) => c.type !== 'expense');

  const [editing, setEditing] = useState<{ id?: string; values: AccountValues } | null>(null);
  const [deleting, setDeleting] = useState<AccountBalance | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Held by id rather than by object so a refresh after an edit is reflected
  // in the open modal instead of showing the figures it was opened with.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewing = balances.find((b) => b.account.id === viewingId) ?? null;

  const [money, setMoney] = useState<AccountBalance | null>(null);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [depositValues, setDepositValues] = useState<DepositValues>({
    amount: '',
    categoryId: '',
    date: todayIso(),
    note: '',
  });
  const [depositErrors, setDepositErrors] = useState<Record<string, string>>({});
  const [depositFormError, setDepositFormError] = useState<string | null>(null);
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [deletingDeposit, setDeletingDeposit] = useState<Deposit | null>(null);

  function resetDepositForm() {
    setDepositId(null);
    // No category is preselected: guessing one would put money against a pot
    // the user never chose, and the field is optional anyway.
    setDepositValues({ amount: '', categoryId: '', date: todayIso(), note: '' });
    setDepositErrors({});
    setDepositFormError(null);
  }

  function openMoney(balance: AccountBalance) {
    resetDepositForm();
    setViewingId(null);
    setMoney(balance);
  }

  /** Editing an added-money row from the history hands over to the money form. */
  function editAddedMoney(balance: AccountBalance, id: string) {
    const entry = deposits.find((d) => d.id === id);
    if (!entry) return;
    setViewingId(null);
    setMoney(balance);
    editDeposit(entry);
  }

  function removeAddedMoney(id: string) {
    const entry = deposits.find((d) => d.id === id);
    if (entry) setDeletingDeposit(entry);
  }

  function editDeposit(entry: Deposit) {
    setDepositErrors({});
    setDepositFormError(null);
    setDepositId(entry.id);
    setDepositValues({
      amount: String(entry.amount),
      categoryId: entry.categoryId ?? '',
      date: entry.date,
      note: entry.note,
    });
  }

  function setDeposit<K extends keyof DepositValues>(key: K, value: DepositValues[K]) {
    setDepositValues((current) => ({ ...current, [key]: value }));
    setDepositErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function saveDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!money || savingDeposit) return;

    setSavingDeposit(true);
    setDepositFormError(null);
    setDepositErrors({});

    const response = await apiRequest<{ deposit: Deposit }>(
      depositId ? `/api/deposits/${depositId}` : '/api/deposits',
      {
        method: depositId ? 'PUT' : 'POST',
        body: { ...depositValues, accountId: money.account.id },
      },
    );

    setSavingDeposit(false);

    if (!response.ok) {
      setDepositFormError(response.error);
      setDepositErrors(response.fieldErrors ?? {});
      return;
    }

    toast.success(depositId ? 'Entry updated.' : `Added to ${money.account.name}.`);
    resetDepositForm();
    router.refresh();
  }

  async function confirmDeleteDeposit() {
    if (!deletingDeposit) return;
    const response = await apiRequest(`/api/deposits/${deletingDeposit.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Entry removed.');
    setDeletingDeposit(null);
    router.refresh();
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
  /** What an added-money row is called: its category, or simply what it is. */
  const depositLabel = (entry: Deposit) => (entry.categoryId ? categoryName(entry.categoryId) : 'Money added');

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

  const depositsIn = (accountId: string) => deposits.filter((d) => d.accountId === accountId);
  const entriesFor = (accountId: string) =>
    activity.find((a) => a.account.id === accountId)?.entries ?? [];

  /** Date, what kind of movement it was, and any detail — without repeating the title. */
  function metaFor(entry: AccountEntry): string {
    const kind = KIND_LABELS[entry.kind];
    return [formatDate(entry.date, settings.dateFormat), kind === entry.title ? '' : kind, entry.subtitle]
      .filter(Boolean)
      .join(' · ');
  }

  async function confirmDelete() {
    if (!deleting) return;
    // Transactions are kept and simply unlinked; money added to the account
    // goes with it, since a deposit with no account records nothing. Either one
    // means the delete has to be confirmed rather than done silently.
    const history = deleting.transactionCount + depositsIn(deleting.account.id).length;
    const strategy = history > 0 ? '?strategy=unassign' : '';
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
            const stored = contents.find((c) => c.account.id === balance.account.id);
            return (
              <div key={balance.account.id} className="surface group relative flex flex-col p-4">
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
                  <div className="relative z-10 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
                  {balance.addedIn > 0 && (
                    <DetailRow
                      label="Money added"
                      tone="positive"
                      value={`+ ${formatCurrency(balance.addedIn, { currencySymbol: symbol })}`}
                    />
                  )}
                  <DetailRow
                    label="Paid out"
                    tone="muted"
                    value={`− ${formatCurrency(balance.paidOut, { currencySymbol: symbol })}`}
                  />
                </dl>

                {stored && stored.slices.length > 0 && (
                  <dl className="mt-3 space-y-1.5 border-t border-line pt-3">
                    <p className="label mb-1">What is in here</p>
                    {stored.slices.map((slice) => (
                      <DetailRow
                        key={slice.category.id}
                        label={slice.category.name}
                        value={formatCurrency(slice.amount, { currencySymbol: symbol })}
                      />
                    ))}
                  </dl>
                )}

                <div className="relative z-10 mt-3 border-t border-line pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    className="w-full"
                    onClick={() => openMoney(balance)}
                  >
                    Add money
                  </Button>
                </div>

                {/* Last so it lies over the card's text: clicking anywhere that
                    is not one of the controls above opens the account. */}
                <button
                  type="button"
                  className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`Open ${balance.account.name}`}
                  onClick={() => setViewingId(balance.account.id)}
                />
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
            deleting.transactionCount > 0 || depositsIn(deleting.account.id).length > 0 ? (
              <>
                <strong className="font-medium text-ink">{deleting.account.name}</strong>
                {deleting.transactionCount > 0 && (
                  <>
                    {' '}
                    is used by {deleting.transactionCount} entr
                    {deleting.transactionCount === 1 ? 'y' : 'ies'}, which are kept and still count towards your
                    spending and budgets — they simply stop being linked to an account
                  </>
                )}
                {depositsIn(deleting.account.id).length > 0 && (
                  <>
                    {deleting.transactionCount > 0 ? ', and' : ''} holds{' '}
                    {formatCurrency(
                      depositsIn(deleting.account.id).reduce((total, d) => total + d.amount, 0),
                      { currencySymbol: symbol },
                    )}{' '}
                    of money you added, which is removed with it
                  </>
                )}
                .
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

      <Modal
        open={viewing !== null}
        onClose={() => setViewingId(null)}
        title={viewing ? viewing.account.name : 'Account'}
        description="Everything that has moved through this account."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewingId(null)}>
              Close
            </Button>
            {viewing && (
              <Button variant="primary" icon={Plus} onClick={() => openMoney(viewing)}>
                Add money
              </Button>
            )}
          </>
        }
      >
        {viewing && (
          <div className="space-y-5">
            <div>
              <p
                className={`tnum text-2xl font-semibold ${viewing.currentBalance < 0 ? 'text-danger' : 'text-ink'}`}
              >
                {formatCurrency(viewing.currentBalance, { currencySymbol: symbol })}
              </p>
              <p className="label mt-0.5">Current balance</p>
            </div>

            <dl className="space-y-1.5 border-t border-line pt-4">
              <DetailRow
                label="Opening"
                tone="muted"
                value={formatCurrency(viewing.openingBalance, { currencySymbol: symbol })}
              />
              <DetailRow
                label="Income in"
                tone="positive"
                value={`+ ${formatCurrency(viewing.incomeIn, { currencySymbol: symbol })}`}
              />
              {viewing.receivedIn > 0 && (
                <DetailRow
                  label="Repayments in"
                  tone="positive"
                  value={`+ ${formatCurrency(viewing.receivedIn, { currencySymbol: symbol })}`}
                />
              )}
              {viewing.addedIn > 0 && (
                <DetailRow
                  label="Money added"
                  tone="positive"
                  value={`+ ${formatCurrency(viewing.addedIn, { currencySymbol: symbol })}`}
                />
              )}
              <DetailRow
                label="Paid out"
                tone="muted"
                value={`− ${formatCurrency(viewing.paidOut, { currencySymbol: symbol })}`}
              />
            </dl>

            <div className="border-t border-line pt-4">
              <p className="label mb-2">History</p>
              {entriesFor(viewing.account.id).length === 0 ? (
                <p className="text-sm text-muted">
                  Nothing has moved through this account yet. Money you add, income you point here and anything paid
                  from it will be listed.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {entriesFor(viewing.account.id).map((entry) => (
                    <li key={`${entry.kind}-${entry.id}`} className="flex items-center gap-3 py-2.5">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          entry.direction === 'in' ? 'bg-positive-soft text-positive' : 'bg-sunken text-ink-soft'
                        }`}
                      >
                        {entry.direction === 'in' ? (
                          <ArrowDownLeft size={14} strokeWidth={2} aria-hidden />
                        ) : (
                          <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base text-ink">{entry.title}</p>
                        <p className="truncate text-sm text-muted">{metaFor(entry)}</p>
                      </div>
                      <span
                        className={`tnum shrink-0 text-base font-medium ${
                          entry.direction === 'in' ? 'text-positive' : 'text-ink'
                        }`}
                      >
                        {entry.direction === 'in' ? '+' : '−'}{' '}
                        {formatCurrency(entry.amount, { currencySymbol: symbol })}
                      </span>
                      {entry.kind === 'added' && (
                        <div className="flex shrink-0 gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            icon={Pencil}
                            aria-label="Edit money added"
                            onClick={() => editAddedMoney(viewing, entry.id)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            icon={Trash2}
                            aria-label="Remove money added"
                            onClick={() => removeAddedMoney(entry.id)}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={money !== null}
        onClose={() => !savingDeposit && setMoney(null)}
        title={money ? `Money in ${money.account.name}` : 'Money'}
        description="Money added is neither income nor spending — it only moves this balance. Say what it is for if you know."
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoney(null)} disabled={savingDeposit}>
              Close
            </Button>
            <Button type="submit" form="deposit-form" variant="primary" loading={savingDeposit}>
              {depositId ? 'Save changes' : 'Add money'}
            </Button>
          </>
        }
      >
        {money && (
          <div className="space-y-5">
            <form id="deposit-form" onSubmit={saveDeposit} noValidate className="space-y-4">
              <FormError message={depositFormError} />
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
                  value={depositValues.amount}
                  error={depositErrors.amount}
                  onChange={(e) => setDeposit('amount', e.target.value)}
                />
                <TextField
                  label="Date"
                  type="date"
                  required
                  value={depositValues.date}
                  error={depositErrors.date}
                  onChange={(e) => setDeposit('date', e.target.value)}
                />
              </div>

              <SelectField
                label="What is it for"
                hint="Optional — the category or savings pot this money belongs to."
                value={depositValues.categoryId}
                error={depositErrors.categoryId}
                onChange={(e) => setDeposit('categoryId', e.target.value)}
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
                autoComplete="off"
                placeholder="Moved from salary"
                value={depositValues.note}
                error={depositErrors.note}
                onChange={(e) => setDeposit('note', e.target.value)}
              />

              {depositId && (
                <Button type="button" variant="ghost" size="sm" onClick={resetDepositForm}>
                  Cancel edit
                </Button>
              )}
            </form>

            <div className="border-t border-line pt-4">
              <p className="label mb-2">Already in here</p>
              {depositsIn(money.account.id).length === 0 ? (
                <p className="text-sm text-muted">Nothing yet. What you add above is listed here.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {depositsIn(money.account.id).map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base text-ink">{depositLabel(entry)}</p>
                        <p className="truncate text-sm text-muted">
                          {formatDate(entry.date, settings.dateFormat)}
                          {entry.note && ` · ${entry.note}`}
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-base font-medium text-ink">
                        {formatCurrency(entry.amount, { currencySymbol: symbol })}
                      </span>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          icon={Pencil}
                          aria-label="Edit entry"
                          onClick={() => editDeposit(entry)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          icon={Trash2}
                          aria-label="Remove entry"
                          onClick={() => setDeletingDeposit(entry)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deletingDeposit !== null}
        title="Remove this money?"
        body={
          deletingDeposit ? (
            <>
              <strong className="font-medium text-ink">
                {formatCurrency(deletingDeposit.amount, { currencySymbol: symbol })}
              </strong>
              {deletingDeposit.categoryId ? ` set against ${categoryName(deletingDeposit.categoryId)}` : ''} will be
              removed, and the balance recalculated.
            </>
          ) : null
        }
        onConfirm={confirmDeleteDeposit}
        onCancel={() => setDeletingDeposit(null)}
      />
    </>
  );
}
