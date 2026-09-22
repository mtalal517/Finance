'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, Minus, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { useExpenseModal } from '@/components/expenses/ExpenseModalProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormError, TextAreaField, TextField } from '@/components/ui/Field';
import { Badge, DetailRow, EmptyState, ProgressBar } from '@/components/ui/Primitives';
import { apiRequest } from '@/lib/client/api';
import { formatDate, todayIso } from '@/lib/finance/dates';
import { formatCurrency, formatPercent } from '@/lib/finance/format';
import type { GoalProgress } from '@/lib/finance/calculations';
import type { DateFormat, Goal } from '@/lib/types';

/**
 * Goals, their progress and their contribution history.
 *
 * Progress is the sum of real deposits rather than a number you overwrite, so
 * "add money" leaves a trail you can look back at. Spending from a goal writes
 * an ordinary expense carrying the goal's id; it shows here in the same trail.
 */

interface GoalValues {
  name: string;
  targetAmount: string;
  initialAmount: string;
  targetDate: string;
  description: string;
}

const BLANK: GoalValues = { name: '', targetAmount: '', initialAmount: '', targetDate: '', description: '' };

export function GoalsManager({
  goals,
  symbol,
  dateFormat,
}: {
  goals: GoalProgress[];
  symbol: string;
  dateFormat: DateFormat;
}) {
  const router = useRouter();
  const toast = useToast();
  const { addExpense } = useExpenseModal();

  const [editing, setEditing] = useState<{ id?: string; values: GoalValues } | null>(null);
  const [contributing, setContributing] = useState<GoalProgress | null>(null);
  const [contribution, setContribution] = useState({ amount: '', date: todayIso(), note: '' });
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function resetErrors() {
    setFormError(null);
    setFieldErrors({});
  }

  function openAdd() {
    resetErrors();
    setEditing({ values: { ...BLANK } });
  }

  function openEdit(goal: Goal) {
    resetErrors();
    setEditing({
      id: goal.id,
      values: {
        name: goal.name,
        targetAmount: String(goal.targetAmount),
        initialAmount: String(goal.initialAmount),
        targetDate: goal.targetDate ?? '',
        description: goal.description,
      },
    });
  }

  function openContribute(progress: GoalProgress) {
    resetErrors();
    setContribution({ amount: '', date: todayIso(), note: '' });
    setContributing(progress);
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;

    setSaving(true);
    resetErrors();

    const response = await apiRequest<{ goal: Goal }>(editing.id ? `/api/goals/${editing.id}` : '/api/goals', {
      method: editing.id ? 'PUT' : 'POST',
      body: { ...editing.values, targetDate: editing.values.targetDate || null },
    });

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    toast.success(editing.id ? 'Goal updated.' : 'Goal created.');
    setEditing(null);
    router.refresh();
  }

  async function saveContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contributing || saving) return;

    setSaving(true);
    resetErrors();

    const response = await apiRequest<{ goal: Goal }>(`/api/goals/${contributing.goal.id}/contributions`, {
      method: 'POST',
      body: contribution,
    });

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    toast.success(`Added to ${contributing.goal.name}.`);
    setContributing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const response = await apiRequest(`/api/goals/${deleting.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Goal deleted.');
    setDeleting(null);
    router.refresh();
  }

  async function removeContribution(goalId: string, contributionId: string) {
    const response = await apiRequest(`/api/goals/${goalId}/contributions/${contributionId}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Contribution removed.');
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={Plus} onClick={openAdd}>
          Add goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={Target}
            title="No goals yet"
            body="Set something to work towards — an emergency fund, a laptop, a trip — and track the money you put aside for it."
            action={
              <Button variant="primary" icon={Plus} onClick={openAdd}>
                Add your first goal
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((progress) => {
            const { goal } = progress;
            const isOpen = expanded === goal.id;
            return (
              <div key={goal.id} className="surface group flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-ink">{goal.name}</h3>
                    {goal.description && <p className="mt-0.5 text-sm text-muted">{goal.description}</p>}
                  </div>
                  {progress.isComplete ? (
                    <Badge tone="positive">Reached</Badge>
                  ) : progress.isOverdue ? (
                    <Badge tone="danger">Past target date</Badge>
                  ) : progress.daysRemaining !== null ? (
                    <Badge tone="neutral">{progress.daysRemaining} days left</Badge>
                  ) : null}
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <p className="tnum text-xl font-semibold text-ink">
                    {formatCurrency(progress.currentAmount, { currencySymbol: symbol })}
                    <span className="ml-1.5 text-sm font-normal text-muted">
                      of {formatCurrency(progress.targetAmount, { currencySymbol: symbol })}
                    </span>
                  </p>
                  <p className="tnum text-base font-medium text-ink-soft">
                    {formatPercent(progress.percentComplete, 0)}
                  </p>
                </div>

                <ProgressBar
                  percent={progress.percentComplete}
                  tone={progress.isComplete ? 'positive' : 'neutral'}
                  className="mt-2"
                  label={`${goal.name} progress`}
                />

                <dl className="mt-4 space-y-2">
                  <DetailRow
                    label="Still needed"
                    value={formatCurrency(progress.remaining, { currencySymbol: symbol })}
                  />
                  {progress.spent > 0 && (
                    <DetailRow
                      label="Spent from goal"
                      tone="muted"
                      value={formatCurrency(progress.spent, { currencySymbol: symbol })}
                    />
                  )}
                  <DetailRow
                    label="Target date"
                    tone="muted"
                    value={goal.targetDate ? formatDate(goal.targetDate, dateFormat) : 'No date set'}
                  />
                  {progress.requiredPerMonth !== null && progress.requiredPerMonth > 0 && (
                    <DetailRow
                      label="To arrive on time"
                      value={`${formatCurrency(progress.requiredPerMonth, { currencySymbol: symbol })} a month`}
                    />
                  )}
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <Button size="sm" variant="primary" icon={Plus} onClick={() => openContribute(progress)}>
                    Add money
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Minus}
                    disabled={progress.currentAmount <= 0}
                    onClick={() => addExpense({ goalId: goal.id })}
                  >
                    Spend
                  </Button>
                  {progress.activity.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : goal.id)}>
                      {isOpen ? 'Hide history' : `${progress.activity.length} ${progress.activity.length === 1 ? 'entry' : 'entries'}`}
                    </Button>
                  )}
                  <div className="ml-auto flex gap-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={Pencil}
                      aria-label={`Edit ${goal.name}`}
                      onClick={() => openEdit(goal)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={Trash2}
                      aria-label={`Delete ${goal.name}`}
                      onClick={() => setDeleting(goal)}
                    />
                  </div>
                </div>

                {isOpen && (
                  <ul className="mt-3 divide-y divide-line border-t border-line pt-1">
                    {progress.activity.map((item) =>
                      item.kind === 'contribution' ? (
                        <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                          <span className="tnum w-20 shrink-0 text-muted">{formatDate(item.date, dateFormat)}</span>
                          <ArrowDownLeft size={14} strokeWidth={2} className="shrink-0 text-positive" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-ink-soft">{item.note || 'Added'}</span>
                          <span className="tnum shrink-0 font-medium text-positive">
                            +{formatCurrency(item.amount, { currencySymbol: symbol })}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeContribution(goal.id, item.id)}
                            className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-sunken hover:text-danger"
                            aria-label="Remove contribution"
                          >
                            <X size={13} strokeWidth={2} aria-hidden />
                          </button>
                        </li>
                      ) : (
                        <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                          <span className="tnum w-20 shrink-0 text-muted">{formatDate(item.date, dateFormat)}</span>
                          <ArrowUpRight size={14} strokeWidth={2} className="shrink-0 text-danger" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-ink-soft">
                            {item.transaction.description || 'Spent'}
                          </span>
                          <span className="tnum shrink-0 font-medium text-danger">
                            −{formatCurrency(item.amount, { currencySymbol: symbol })}
                          </span>
                          {/* An expense is edited where it lives; unlinking it is one field there. */}
                          <span className="w-[21px] shrink-0" aria-hidden />
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit goal' : 'New goal'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="goal-form" variant="primary" loading={saving}>
              {editing?.id ? 'Save changes' : 'Create goal'}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="goal-form" onSubmit={saveGoal} noValidate className="space-y-4">
            <FormError message={formError} />
            <TextField
              label="Goal name"
              required
              placeholder="Emergency fund"
              maxLength={120}
              value={editing.values.name}
              error={fieldErrors.name}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, name: e.target.value } })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Target amount"
                type="number"
                min="0"
                step="0.01"
                required
                prefix={symbol}
                placeholder="300000"
                value={editing.values.targetAmount}
                error={fieldErrors.targetAmount}
                onChange={(e) =>
                  setEditing({ ...editing, values: { ...editing.values, targetAmount: e.target.value } })
                }
              />
              <TextField
                label="Already saved"
                type="number"
                min="0"
                step="0.01"
                prefix={symbol}
                placeholder="0"
                hint="What is in this goal today."
                value={editing.values.initialAmount}
                error={fieldErrors.initialAmount}
                onChange={(e) =>
                  setEditing({ ...editing, values: { ...editing.values, initialAmount: e.target.value } })
                }
              />
            </div>
            <TextField
              label="Target date"
              type="date"
              value={editing.values.targetDate}
              error={fieldErrors.targetDate}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, targetDate: e.target.value } })}
            />
            <TextAreaField
              label="Description"
              rows={2}
              maxLength={500}
              placeholder="Six months of expenses set aside"
              value={editing.values.description}
              error={fieldErrors.description}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, description: e.target.value } })}
            />
          </form>
        )}
      </Modal>

      <Modal
        open={contributing !== null}
        onClose={() => !saving && setContributing(null)}
        title={`Add money to ${contributing?.goal.name ?? ''}`}
        description={
          contributing
            ? `${formatCurrency(contributing.remaining, { currencySymbol: symbol })} still to go.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setContributing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="contribution-form" variant="primary" loading={saving}>
              Add money
            </Button>
          </>
        }
      >
        <form id="contribution-form" onSubmit={saveContribution} noValidate className="space-y-4">
          <FormError message={formError} />
          <TextField
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            required
            prefix={symbol}
            placeholder="0"
            value={contribution.amount}
            error={fieldErrors.amount}
            onChange={(e) => setContribution({ ...contribution, amount: e.target.value })}
          />
          <TextField
            label="Date"
            type="date"
            required
            value={contribution.date}
            error={fieldErrors.date}
            onChange={(e) => setContribution({ ...contribution, date: e.target.value })}
          />
          <TextField
            label="Note"
            maxLength={200}
            placeholder="From September savings"
            value={contribution.note}
            error={fieldErrors.note}
            onChange={(e) => setContribution({ ...contribution, note: e.target.value })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this goal?"
        body={
          deleting ? (
            <>
              <strong className="font-medium text-ink">{deleting.name}</strong> and its{' '}
              {deleting.contributions.length} recorded contribution
              {deleting.contributions.length === 1 ? '' : 's'} will be removed. Expenses drawn from it stay in your
              records, just no longer linked to a goal.
            </>
          ) : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
