'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { useAppData } from '@/components/AppDataProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormError, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Badge, EmptyState, IconTile } from '@/components/ui/Primitives';
import { IconPicker } from '@/components/ui/IconPicker';
import { iconFor } from '@/lib/icons/registry';
import { apiRequest } from '@/lib/client/api';
import { formatDate, todayIso } from '@/lib/finance/dates';
import { formatCurrency } from '@/lib/finance/format';
import type { SubscriptionRow, SubscriptionState } from '@/lib/finance/calculations';
import type { BillingCycle, Subscription } from '@/lib/types';
import type { IconName } from '@/lib/icons/names';

/**
 * The subscription list and its dialogs.
 *
 * The list is the standing instruction — what you pay, how often, and when it
 * falls due next. "Mark paid" is the only action that moves money, and it does
 * so by writing an ordinary transaction, so a subscription charge behaves like
 * any other expense once recorded.
 */

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

/** How the charge is described per cycle, next to the amount. */
const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  monthly: '/mo',
  quarterly: '/qtr',
  yearly: '/yr',
};

const STATE_BADGE: Record<SubscriptionState, { label: string; tone: 'danger' | 'warning' | 'neutral' } | null> = {
  overdue: { label: 'Overdue', tone: 'danger' },
  'due-soon': { label: 'Due soon', tone: 'warning' },
  scheduled: null,
  paused: { label: 'Paused', tone: 'neutral' },
};

interface FormValues {
  name: string;
  amount: string;
  cycle: BillingCycle;
  nextDueDate: string;
  categoryId: string;
  accountId: string;
  icon: string;
  active: boolean;
  notes: string;
}

function blankValues(defaultCategoryId: string): FormValues {
  return {
    name: '',
    amount: '',
    cycle: 'monthly',
    nextDueDate: todayIso(),
    categoryId: defaultCategoryId,
    accountId: '',
    icon: 'repeat',
    active: true,
    notes: '',
  };
}

function dueLabel(days: number): string {
  if (days < -1) return `${Math.abs(days)} days ago`;
  if (days === -1) return 'yesterday';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function SubscriptionsManager({
  rows,
  symbol,
}: {
  rows: SubscriptionRow[];
  symbol: string;
}) {
  const { categories, accounts, settings } = useAppData();
  const router = useRouter();
  const toast = useToast();

  // Spending categories only: a subscription is consumed, never set aside.
  const spendingCategories = categories.filter((c) => c.type === 'expense');
  const defaultCategoryId = spendingCategories[0]?.id ?? '';

  const [editing, setEditing] = useState<{ id?: string; values: FormValues } | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  function openAdd() {
    setFieldErrors({});
    setFormError(null);
    setEditing({ values: blankValues(defaultCategoryId) });
  }

  function openEdit(subscription: Subscription) {
    setFieldErrors({});
    setFormError(null);
    setEditing({
      id: subscription.id,
      values: {
        name: subscription.name,
        amount: String(subscription.amount),
        cycle: subscription.cycle,
        nextDueDate: subscription.nextDueDate,
        categoryId: subscription.categoryId ?? defaultCategoryId,
        accountId: subscription.accountId ?? '',
        icon: subscription.icon,
        active: subscription.active,
        notes: subscription.notes,
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

    const response = await apiRequest<{ subscription: Subscription }>(
      editing.id ? `/api/subscriptions/${editing.id}` : '/api/subscriptions',
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

    toast.success(editing.id ? 'Subscription updated.' : 'Subscription added.');
    setEditing(null);
    router.refresh();
  }

  async function markPaid(row: SubscriptionRow) {
    if (paying) return;
    setPaying(row.subscription.id);

    const response = await apiRequest<{ subscription: Subscription }>(
      `/api/subscriptions/${row.subscription.id}/pay`,
      { method: 'POST' },
    );

    setPaying(null);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    toast.success(
      `${row.subscription.name} recorded — next due ${formatDate(
        response.subscription.nextDueDate,
        settings.dateFormat,
      )}.`,
    );
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const response = await apiRequest(`/api/subscriptions/${deleting.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Subscription removed. Its past charges are kept.');
    setDeleting(null);
    router.refresh();
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  return (
    <>
      <div className="surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">
            Subscriptions
            <span className="ml-2 font-normal text-muted">{rows.length}</span>
          </h2>
          <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>
            Add subscription
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Nothing recurring yet"
            body="Add the things that charge you on a schedule. The app remembers what falls due next; recording a charge writes an ordinary expense against its category."
            action={
              <Button variant="primary" icon={Plus} onClick={openAdd}>
                Add subscription
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const { subscription: sub } = row;
              const Icon = iconFor(sub.icon);
              const badge = STATE_BADGE[row.state];
              const dimmed = row.state === 'paused';

              return (
                <li
                  key={sub.id}
                  className={`group flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 transition-colors hover:bg-sunken/50 ${
                    dimmed ? 'opacity-60' : ''
                  }`}
                >
                  <IconTile icon={Icon} />

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-base font-medium text-ink">{sub.name}</span>
                      {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {CYCLE_LABELS[sub.cycle]}
                      {' · '}
                      {row.state === 'paused'
                        ? `next ${formatDate(sub.nextDueDate, settings.dateFormat)}`
                        : `due ${dueLabel(row.daysUntilDue)}`}
                      {categoryName(sub.categoryId) && ` · ${categoryName(sub.categoryId)}`}
                      {accountName(sub.accountId) && ` · ${accountName(sub.accountId)}`}
                    </p>
                  </div>

                  <div className="tnum shrink-0 text-right">
                    <p className="text-base font-medium text-ink">
                      {formatCurrency(sub.amount, { currencySymbol: symbol })}
                      <span className="text-sm font-normal text-muted">{CYCLE_SUFFIX[sub.cycle]}</span>
                    </p>
                    {sub.cycle !== 'monthly' && (
                      <p className="text-sm text-muted">
                        {formatCurrency(row.monthlyCost, { currencySymbol: symbol }, { decimals: 0 })} a month
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {sub.active && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Check}
                        loading={paying === sub.id}
                        onClick={() => markPaid(row)}
                      >
                        Mark paid
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={Pencil}
                      aria-label={`Edit ${sub.name}`}
                      onClick={() => openEdit(sub)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={Trash2}
                      aria-label={`Delete ${sub.name}`}
                      onClick={() => setDeleting(sub)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit subscription' : 'Add subscription'}
        description="Recording this moves no money. Marking it paid writes the charge as an expense."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="subscription-form" variant="primary" loading={saving}>
              {editing?.id ? 'Save changes' : 'Add subscription'}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="subscription-form" onSubmit={save} noValidate className="space-y-4">
            <FormError message={formError} />

            <TextField
              label="Name"
              placeholder="Netflix"
              required
              maxLength={120}
              autoComplete="off"
              value={editing.values.name}
              error={fieldErrors.name}
              onChange={(e) => set('name', e.target.value)}
            />

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
                hint="Charged each cycle, not each month."
                value={editing.values.amount}
                error={fieldErrors.amount}
                onChange={(e) => set('amount', e.target.value)}
              />
              <SelectField
                label="Billed"
                required
                value={editing.values.cycle}
                error={fieldErrors.cycle}
                onChange={(e) => set('cycle', e.target.value as BillingCycle)}
              >
                {(Object.keys(CYCLE_LABELS) as BillingCycle[]).map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {CYCLE_LABELS[cycle]}
                  </option>
                ))}
              </SelectField>
            </div>

            <TextField
              label="Next due"
              type="date"
              required
              hint="Marking it paid records the charge on this date, then moves it on one cycle."
              value={editing.values.nextDueDate}
              error={fieldErrors.nextDueDate}
              onChange={(e) => set('nextDueDate', e.target.value)}
            />

            <SelectField
              label="Category"
              required
              hint="The budget category each charge is recorded against."
              value={editing.values.categoryId}
              error={fieldErrors.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
            >
              {spendingCategories.length === 0 && <option value="">No spending categories yet</option>}
              {spendingCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Paid from"
              hint="Choose an account and each charge comes off its balance."
              value={editing.values.accountId}
              error={fieldErrors.accountId}
              onChange={(e) => set('accountId', e.target.value)}
            >
              <option value="">Not specified</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Status"
              hint="A paused subscription stays listed but costs nothing and cannot be paid."
              value={editing.values.active ? 'active' : 'paused'}
              onChange={(e) => set('active', e.target.value === 'active')}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </SelectField>

            <TextAreaField
              label="Notes"
              rows={2}
              maxLength={2000}
              value={editing.values.notes}
              error={fieldErrors.notes}
              onChange={(e) => set('notes', e.target.value)}
            />

            <IconPicker value={editing.values.icon} onChange={(icon: IconName) => set('icon', icon)} />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Remove this subscription?"
        body={
          deleting ? (
            <>
              <strong className="font-medium text-ink">{deleting.name}</strong> will stop being tracked. Charges you
              have already recorded are kept — that money really did leave your account.
            </>
          ) : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
