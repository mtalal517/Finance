'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { HandCoins, Handshake, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { useAppData } from '@/components/AppDataProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormError, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/Primitives';
import { apiRequest } from '@/lib/client/api';
import { formatDate, todayIso } from '@/lib/finance/dates';
import { formatCurrency } from '@/lib/finance/format';
import type { DebtOverview, DebtProgress, DebtStatus } from '@/lib/finance/calculations';
import type { DateFormat, Debt, DebtDirection } from '@/lib/types';

/**
 * Debts you owe and money owed to you.
 *
 * Recording a payment on a debt you owe asks which allocation it comes out of.
 * That choice is what makes the repayment a real transaction against that
 * budget category — it shows up in the category drill-down and reduces the
 * account you paid from, exactly like any other expense.
 */

const STATUS: Record<DebtStatus, { label: string; tone: 'positive' | 'warning' | 'danger' | 'neutral' }> = {
  settled: { label: 'Settled', tone: 'positive' },
  partial: { label: 'Part paid', tone: 'warning' },
  outstanding: { label: 'Outstanding', tone: 'neutral' },
  overdue: { label: 'Overdue', tone: 'danger' },
};

interface DebtValues {
  person: string;
  direction: DebtDirection;
  amount: string;
  date: string;
  dueDate: string;
  description: string;
  notes: string;
}

function blankDebt(direction: DebtDirection): DebtValues {
  return { person: '', direction, amount: '', date: todayIso(), dueDate: '', description: '', notes: '' };
}

export function DebtsManager({
  overview,
  symbol,
  dateFormat,
}: {
  overview: DebtOverview;
  symbol: string;
  dateFormat: DateFormat;
}) {
  const { categories, accounts } = useAppData();
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<{ id?: string; values: DebtValues } | null>(null);
  const [paying, setPaying] = useState<DebtProgress | null>(null);
  const [payment, setPayment] = useState({ amount: '', date: todayIso(), categoryId: '', accountId: '', note: '' });
  const [deleting, setDeleting] = useState<DebtProgress | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function resetErrors() {
    setFormError(null);
    setFieldErrors({});
  }

  function openAdd(direction: DebtDirection) {
    resetErrors();
    setEditing({ values: blankDebt(direction) });
  }

  function openEdit(debt: Debt) {
    resetErrors();
    setEditing({
      id: debt.id,
      values: {
        person: debt.person,
        direction: debt.direction,
        amount: String(debt.amount),
        date: debt.date,
        dueDate: debt.dueDate ?? '',
        description: debt.description,
        notes: debt.notes,
      },
    });
  }

  function openPayment(progress: DebtProgress) {
    resetErrors();
    // Pre-filled with the full outstanding balance, so settling a debt in one
    // go is the default and a part payment is an edit away.
    setPayment({ amount: String(progress.outstanding), date: todayIso(), categoryId: '', accountId: '', note: '' });
    setPaying(progress);
  }

  async function saveDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;

    setSaving(true);
    resetErrors();

    const response = await apiRequest<{ debt: Debt }>(editing.id ? `/api/debts/${editing.id}` : '/api/debts', {
      method: editing.id ? 'PUT' : 'POST',
      body: { ...editing.values, dueDate: editing.values.dueDate || null },
    });

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    toast.success(editing.id ? 'Debt updated.' : 'Debt recorded.');
    setEditing(null);
    router.refresh();
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paying || saving) return;

    setSaving(true);
    resetErrors();

    const response = await apiRequest(`/api/debts/${paying.debt.id}/payments`, {
      method: 'POST',
      body: { ...payment, categoryId: payment.categoryId || null, accountId: payment.accountId || null },
    });

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    const settled = Number(payment.amount) >= paying.outstanding;
    toast.success(
      paying.debt.direction === 'payable'
        ? settled
          ? `${paying.debt.person} is settled.`
          : `Payment to ${paying.debt.person} recorded.`
        : `Repayment from ${paying.debt.person} recorded.`,
    );
    setPaying(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const response = await apiRequest(`/api/debts/${deleting.debt.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Debt removed.');
    setDeleting(null);
    router.refresh();
  }

  const payingPayable = paying?.debt.direction === 'payable';

  return (
    <>
      <DebtSection
        title="I owe"
        description="Money you still have to pay back"
        emptyIcon={HandCoins}
        emptyTitle="You owe nothing"
        emptyBody="Record a loan, a bill you are behind on, or money a friend lent you, and track it down to zero."
        debts={overview.payable}
        symbol={symbol}
        dateFormat={dateFormat}
        expanded={expanded}
        onToggle={setExpanded}
        onAdd={() => openAdd('payable')}
        onPay={openPayment}
        onEdit={openEdit}
        onDelete={setDeleting}
      />

      <div className="mt-8">
        <DebtSection
          title="Owed to me"
          description="Money you have lent out"
          emptyIcon={Handshake}
          emptyTitle="Nobody owes you"
          emptyBody="If you lend money out, record it here so it does not quietly disappear."
          debts={overview.receivable}
          symbol={symbol}
          dateFormat={dateFormat}
          expanded={expanded}
          onToggle={setExpanded}
          onAdd={() => openAdd('receivable')}
          onPay={openPayment}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      </div>

      {/* Add / edit debt */}
      <Modal
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={
          editing?.id
            ? 'Edit debt'
            : editing?.values.direction === 'receivable'
              ? 'Record money owed to you'
              : 'Record a debt you owe'
        }
        description="Recording a debt moves no money. Only payments do that."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="debt-form" variant="primary" loading={saving}>
              {editing?.id ? 'Save changes' : 'Record debt'}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="debt-form" onSubmit={saveDebt} noValidate className="space-y-4">
            <FormError message={formError} />
            <TextField
              label={editing.values.direction === 'payable' ? 'Who you owe' : 'Who owes you'}
              required
              maxLength={120}
              placeholder="Ahmed"
              value={editing.values.person}
              error={fieldErrors.person}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, person: e.target.value } })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Amount"
                type="number"
                min="0"
                step="0.01"
                required
                prefix={symbol}
                placeholder="0"
                value={editing.values.amount}
                error={fieldErrors.amount}
                onChange={(e) => setEditing({ ...editing, values: { ...editing.values, amount: e.target.value } })}
              />
              <TextField
                label="Date"
                type="date"
                required
                hint="When the debt started."
                value={editing.values.date}
                error={fieldErrors.date}
                onChange={(e) => setEditing({ ...editing, values: { ...editing.values, date: e.target.value } })}
              />
            </div>
            <TextField
              label="Due date"
              type="date"
              hint="Leave blank if there is no deadline."
              value={editing.values.dueDate}
              error={fieldErrors.dueDate}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, dueDate: e.target.value } })}
            />
            <TextField
              label="What it is for"
              maxLength={200}
              placeholder="Emergency loan"
              value={editing.values.description}
              error={fieldErrors.description}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, description: e.target.value } })}
            />
            <TextAreaField
              label="Notes"
              rows={2}
              maxLength={2000}
              value={editing.values.notes}
              error={fieldErrors.notes}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, notes: e.target.value } })}
            />
          </form>
        )}
      </Modal>

      {/* Record a payment */}
      <Modal
        open={paying !== null}
        onClose={() => !saving && setPaying(null)}
        title={payingPayable ? `Pay ${paying?.debt.person ?? ''}` : `Repayment from ${paying?.debt.person ?? ''}`}
        description={
          paying ? `${formatCurrency(paying.outstanding, { currencySymbol: symbol })} outstanding.` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaying(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="payment-form" variant="primary" loading={saving}>
              Record payment
            </Button>
          </>
        }
      >
        {paying && (
          <form id="payment-form" onSubmit={savePayment} noValidate className="space-y-4">
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Amount"
                type="number"
                min="0"
                step="0.01"
                required
                prefix={symbol}
                value={payment.amount}
                error={fieldErrors.amount}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              />
              <TextField
                label="Date"
                type="date"
                required
                value={payment.date}
                error={fieldErrors.date}
                onChange={(e) => setPayment({ ...payment, date: e.target.value })}
              />
            </div>

            {payingPayable && (
              <SelectField
                label="From allocation"
                required
                value={payment.categoryId}
                error={fieldErrors.categoryId}
                hint="Which budget this comes out of. It counts against that category for the month."
                onChange={(e) => setPayment({ ...payment, categoryId: e.target.value })}
              >
                <option value="">Choose a category…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectField>
            )}

            <SelectField
              label={payingPayable ? 'Paid from' : 'Received into'}
              value={payment.accountId}
              error={fieldErrors.accountId}
              hint={
                payingPayable
                  ? 'The balance of this account goes down.'
                  : 'Leave blank to log the repayment without moving a balance.'
              }
              onChange={(e) => setPayment({ ...payment, accountId: e.target.value })}
            >
              <option value="">Not specified</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Description"
              maxLength={200}
              placeholder={payingPayable ? `Debt payment — ${paying.debt.person}` : 'Repayment received'}
              value={payment.note}
              error={fieldErrors.note}
              onChange={(e) => setPayment({ ...payment, note: e.target.value })}
            />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Remove this debt?"
        confirmLabel="Remove debt"
        body={
          deleting ? (
            <>
              The record for <strong className="font-medium text-ink">{deleting.debt.person}</strong> will be removed.
              {deleting.payments.length > 0 && (
                <>
                  {' '}
                  The {deleting.payments.length} payment{deleting.payments.length === 1 ? '' : 's'} already recorded
                  are kept as ordinary transactions — that money really did leave your account, so deleting it would
                  inflate your balances.
                </>
              )}
            </>
          ) : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function DebtSection({
  title,
  description,
  emptyIcon,
  emptyTitle,
  emptyBody,
  debts,
  symbol,
  dateFormat,
  expanded,
  onToggle,
  onAdd,
  onPay,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  debts: DebtProgress[];
  symbol: string;
  dateFormat: DateFormat;
  expanded: string | null;
  onToggle: (id: string | null) => void;
  onAdd: () => void;
  onPay: (debt: DebtProgress) => void;
  onEdit: (debt: Debt) => void;
  onDelete: (debt: DebtProgress) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
        <Button variant={debts.length === 0 ? 'secondary' : 'primary'} size="sm" icon={Plus} onClick={onAdd}>
          Add
        </Button>
      </div>

      {debts.length === 0 ? (
        <div className="surface">
          <EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} compact />
        </div>
      ) : (
        <ul className="space-y-3">
          {debts.map((progress) => {
            const { debt } = progress;
            const isOpen = expanded === debt.id;
            const status = STATUS[progress.status];
            return (
              <li key={debt.id} className="surface group p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                      {debt.person}
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </h3>
                    <p className="mt-0.5 text-sm text-muted">
                      {debt.description || 'No description'}
                      {debt.dueDate && (
                        <>
                          {' · '}due {formatDate(debt.dueDate, dateFormat)}
                          {progress.daysUntilDue !== null && progress.outstanding > 0 && (
                            <>
                              {' '}
                              (
                              {progress.daysUntilDue < 0
                                ? `${Math.abs(progress.daysUntilDue)} days late`
                                : `in ${progress.daysUntilDue} days`}
                              )
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`tnum text-xl font-semibold ${progress.outstanding > 0 ? 'text-ink' : 'text-positive'}`}>
                      {formatCurrency(progress.outstanding, { currencySymbol: symbol })}
                    </p>
                    <p className="text-sm text-muted">
                      outstanding of {formatCurrency(debt.amount, { currencySymbol: symbol })}
                    </p>
                  </div>
                </div>

                <ProgressBar
                  percent={progress.percentPaid}
                  tone={progress.status === 'overdue' ? 'danger' : progress.outstanding <= 0 ? 'positive' : 'neutral'}
                  className="mt-4"
                  label={`${debt.person} repaid`}
                />
                <p className="mt-1.5 text-sm text-muted">
                  {formatCurrency(progress.paid, { currencySymbol: symbol })} paid so far
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  {progress.outstanding > 0 && (
                    <Button size="sm" variant="primary" onClick={() => onPay(progress)}>
                      {debt.direction === 'payable' ? 'Mark payment' : 'Record repayment'}
                    </Button>
                  )}
                  {progress.payments.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => onToggle(isOpen ? null : debt.id)}>
                      {isOpen
                        ? 'Hide payments'
                        : `${progress.payments.length} payment${progress.payments.length === 1 ? '' : 's'}`}
                    </Button>
                  )}
                  <div className="ml-auto flex gap-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={Pencil}
                      aria-label={`Edit debt for ${debt.person}`}
                      onClick={() => onEdit(debt)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={Trash2}
                      aria-label={`Remove debt for ${debt.person}`}
                      onClick={() => onDelete(progress)}
                    />
                  </div>
                </div>

                {isOpen && (
                  <ul className="mt-3 divide-y divide-line border-t border-line pt-1">
                    {progress.payments.map((paymentRow) => (
                      <li key={paymentRow.id} className="flex items-center gap-3 py-2 text-sm">
                        <span className="tnum w-20 shrink-0 text-muted">{formatDate(paymentRow.date, dateFormat)}</span>
                        <span className="min-w-0 flex-1 truncate text-ink-soft">{paymentRow.description}</span>
                        <span className="tnum shrink-0 font-medium text-ink">
                          {formatCurrency(paymentRow.amount, { currencySymbol: symbol })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
