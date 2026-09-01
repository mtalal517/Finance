'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy } from 'lucide-react';
import { useAppData } from '@/components/AppDataProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { apiRequest } from '@/lib/client/api';
import { iconFor } from '@/lib/icons/registry';
import { formatCurrency } from '@/lib/finance/format';
import { monthLabel } from '@/lib/finance/dates';
import type { Budget, Category } from '@/lib/types';

/**
 * Sets the month's allocations.
 *
 * The running totals here are a live preview only — the figures the rest of the
 * app uses are recomputed on the server from what actually gets saved.
 */
export function BudgetEditor({
  month,
  allocations,
  income,
  symbol,
  canCopyPrevious,
}: {
  month: string;
  allocations: Record<string, number>;
  income: number;
  symbol: string;
  canCopyPrevious: boolean;
}) {
  const { categories } = useAppData();
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, allocations[c.id] ? String(allocations[c.id]) : ''])),
  );
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const totalAllocated = useMemo(
    () =>
      Object.values(values).reduce((total, raw) => {
        const n = Number(String(raw).replace(/,/g, ''));
        return Number.isFinite(n) && n > 0 ? total + n : total;
      }, 0),
    [values],
  );
  const unallocated = income - totalAllocated;

  const dirty = useMemo(
    () =>
      categories.some((c) => {
        const saved = allocations[c.id] ? String(allocations[c.id]) : '';
        return (values[c.id] ?? '') !== saved;
      }),
    [categories, allocations, values],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const response = await apiRequest<{ budget: Budget }>('/api/budgets', {
      method: 'PUT',
      body: { month, categories: values },
    });

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      // Errors come back keyed `categories.<id>`; flatten them onto the inputs.
      const flattened: Record<string, string> = {};
      for (const [key, message] of Object.entries(response.fieldErrors ?? {})) {
        flattened[key.replace(/^categories\./, '')] = message;
      }
      setFieldErrors(flattened);
      return;
    }

    toast.success(`Budget saved for ${monthLabel(month)}.`);
    router.refresh();
  }

  async function copyPrevious() {
    setCopying(true);
    const response = await apiRequest<{ budget: Budget }>('/api/budgets/copy', {
      method: 'POST',
      body: { month },
    });
    setCopying(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    setValues(
      Object.fromEntries(
        categories.map((c) => [c.id, response.budget.categories[c.id] ? String(response.budget.categories[c.id]) : '']),
      ),
    );
    toast.success("Copied last month's budget.");
    router.refresh();
  }

  const spending = categories.filter((c) => c.type === 'expense');
  const setAside = categories.filter((c) => c.type !== 'expense');

  return (
    <form onSubmit={save} noValidate>
      {formError && (
        <div className="mb-4">
          <FormError message={formError} />
        </div>
      )}

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
        <AllocationGroup
          title="Spending"
          description="Money you expect to consume this month"
          categories={spending}
          values={values}
          errors={fieldErrors}
          symbol={symbol}
          onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        />
        <AllocationGroup
          title="Set aside"
          description="Savings and investments, counted apart from spending"
          categories={setAside}
          values={values}
          errors={fieldErrors}
          symbol={symbol}
          onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="label">Allocated</dt>
            <dd className="tnum mt-1 text-lg font-semibold text-ink">
              {formatCurrency(totalAllocated, { currencySymbol: symbol })}
            </dd>
          </div>
          <div>
            <dt className="label">Unallocated</dt>
            <dd
              className={`tnum mt-1 text-lg font-semibold ${
                unallocated < 0 ? 'text-danger' : unallocated === 0 ? 'text-positive' : 'text-ink'
              }`}
            >
              {formatCurrency(unallocated, { currencySymbol: symbol })}
            </dd>
            {unallocated < 0 && <p className="mt-0.5 text-sm font-medium text-danger">More than you earned</p>}
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {canCopyPrevious && (
            <Button type="button" variant="secondary" icon={Copy} onClick={copyPrevious} loading={copying}>
              Copy last month
            </Button>
          )}
          {/* A disabled primary button reads as broken. When there is nothing
              to save, say so in text and keep the button out of the way. */}
          {dirty ? (
            <Button type="submit" variant="primary" loading={saving}>
              Save budget
            </Button>
          ) : (
            <p className="inline-flex h-9 items-center gap-1.5 text-sm font-medium text-muted">
              <Check size={14} strokeWidth={2} aria-hidden />
              All changes saved
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

function AllocationGroup({
  title,
  description,
  categories,
  values,
  errors,
  symbol,
  onChange,
}: {
  title: string;
  description: string;
  categories: Category[];
  values: Record<string, string>;
  errors: Record<string, string>;
  symbol: string;
  onChange: (id: string, value: string) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 mb-3 text-sm text-muted">{description}</p>
      <ul className="space-y-1.5">
        {categories.map((category) => {
          const Icon = iconFor(category.icon);
          return (
            <li key={category.id}>
              <label className="flex items-center gap-3">
                <Icon size={15} strokeWidth={1.9} className="shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-base text-ink">{category.name}</span>
                <span className="relative w-32 shrink-0">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm font-medium text-muted">
                    {symbol}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    aria-label={`${category.name} budget`}
                    aria-invalid={errors[category.id] ? true : undefined}
                    className="field tnum pl-9 text-right"
                    value={values[category.id] ?? ''}
                    onChange={(e) => onChange(category.id, e.target.value)}
                  />
                </span>
              </label>
              {errors[category.id] && (
                <p className="mt-1 text-right text-xs font-medium text-danger">{errors[category.id]}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
