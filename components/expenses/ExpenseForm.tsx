'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/AppDataProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { apiRequest } from '@/lib/client/api';
import { todayIso } from '@/lib/finance/dates';
import type { Transaction } from '@/lib/types';

/**
 * The one transaction form, used by the global "Add Expense" modal and by every
 * edit action. There is no second copy to drift out of sync.
 */

export interface ExpenseFormValues {
  amount: string;
  categoryId: string;
  date: string;
  description: string;
  accountId: string;
  notes: string;
}

export function toFormValues(transaction: Transaction): ExpenseFormValues {
  return {
    amount: String(transaction.amount),
    categoryId: transaction.categoryId ?? '',
    date: transaction.date,
    description: transaction.description,
    accountId: transaction.accountId ?? '',
    notes: transaction.notes,
  };
}

export function emptyFormValues(defaults: Partial<ExpenseFormValues> = {}): ExpenseFormValues {
  return {
    amount: '',
    categoryId: '',
    date: todayIso(),
    description: '',
    accountId: '',
    notes: '',
    ...defaults,
  };
}

interface ExpenseFormProps {
  formId: string;
  initial: ExpenseFormValues;
  transactionId?: string;
  onSaved: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export function ExpenseForm({
  formId,
  initial,
  transactionId,
  onSaved,
  onSubmittingChange,
}: ExpenseFormProps) {
  const { categories, accounts } = useAppData();
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<ExpenseFormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear the error as soon as the user touches the field again.
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function setBusy(busy: boolean) {
    setSubmitting(busy);
    onSubmittingChange?.(busy);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    const body = {
      amount: values.amount,
      categoryId: values.categoryId,
      date: values.date,
      description: values.description,
      accountId: values.accountId || null,
      notes: values.notes,
      direction: 'out' as const,
    };

    const response = await apiRequest<{ transaction: Transaction }>(
      transactionId ? `/api/expenses/${transactionId}` : '/api/expenses',
      { method: transactionId ? 'PUT' : 'POST', body },
    );

    setBusy(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    const category = categories.find((c) => c.id === response.transaction.categoryId);
    toast.success(
      transactionId
        ? 'Transaction updated.'
        : `Added to ${category?.name ?? 'your records'}.`,
    );
    // Pulls fresh totals into every server-rendered figure on the page.
    router.refresh();
    onSaved();
  }

  const expense = categories.filter((c) => c.type === 'expense');
  const setAside = categories.filter((c) => c.type !== 'expense');

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-4">
      <FormError message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          autoComplete="off"
          prefix="Rs."
          placeholder="0"
          value={values.amount}
          error={fieldErrors.amount}
          onChange={(e) => set('amount', e.target.value)}
        />
        <TextField
          label="Date"
          type="date"
          required
          value={values.date}
          error={fieldErrors.date}
          onChange={(e) => set('date', e.target.value)}
        />
      </div>

      <SelectField
        label="Category"
        required
        value={values.categoryId}
        error={fieldErrors.categoryId}
        onChange={(e) => set('categoryId', e.target.value)}
      >
        <option value="">Choose a category…</option>
        {expense.length > 0 && (
          <optgroup label="Spending">
            {expense.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </optgroup>
        )}
        {setAside.length > 0 && (
          <optgroup label="Set aside (not counted as spending)">
            {setAside.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </optgroup>
        )}
      </SelectField>

      <TextField
        label="Description"
        placeholder="Office transport"
        maxLength={200}
        autoComplete="off"
        value={values.description}
        error={fieldErrors.description}
        onChange={(e) => set('description', e.target.value)}
      />

      <SelectField
        label="Paid from"
        value={values.accountId}
        error={fieldErrors.accountId}
        hint="Leave blank if you are not tracking which account this came from."
        onChange={(e) => set('accountId', e.target.value)}
      >
        <option value="">Not specified</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </SelectField>

      <TextAreaField
        label="Notes"
        rows={2}
        maxLength={2000}
        placeholder="Anything worth remembering about this one"
        value={values.notes}
        error={fieldErrors.notes}
        onChange={(e) => set('notes', e.target.value)}
      />

      {/* Lets the form be submitted by Enter even though the button lives in the modal footer. */}
      <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
    </form>
  );
}

export function ExpenseFormSubmit({ formId, submitting, label }: { formId: string; submitting: boolean; label: string }) {
  return (
    <Button type="submit" form={formId} variant="primary" loading={submitting}>
      {label}
    </Button>
  );
}
