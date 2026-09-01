'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextField } from '@/components/ui/Field';
import { currentMonth, formatDate, monthLabel, monthRange, todayIso } from '@/lib/finance/dates';
import { apiRequest } from '@/lib/client/api';
import type { DateFormat, Settings } from '@/lib/types';

const DATE_FORMATS: DateFormat[] = ['dd MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];

export function GeneralSettings({ settings }: { settings: Settings }) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const response = await apiRequest<{ settings: Settings }>('/api/settings', { method: 'PUT', body: values });

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    toast.success('Settings saved.');
    router.refresh();
  }

  // Twelve months either side is plenty for pinning a default.
  const monthOptions = monthRange(currentMonth(), 24);

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <FormError message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Currency code"
          required
          maxLength={8}
          value={values.currency}
          error={fieldErrors.currency}
          onChange={(e) => setValues({ ...values, currency: e.target.value })}
        />
        <TextField
          label="Currency symbol"
          required
          maxLength={8}
          hint="Shown before every amount."
          value={values.currencySymbol}
          error={fieldErrors.currencySymbol}
          onChange={(e) => setValues({ ...values, currencySymbol: e.target.value })}
        />
      </div>

      <SelectField
        label="Date format"
        required
        value={values.dateFormat}
        error={fieldErrors.dateFormat}
        onChange={(e) => setValues({ ...values, dateFormat: e.target.value as DateFormat })}
      >
        {DATE_FORMATS.map((format) => (
          <option key={format} value={format}>
            {format} — {formatDate(todayIso(), format)}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Default month"
        required
        hint="Which month pages open on when you have not chosen one."
        value={values.defaultMonth}
        error={fieldErrors.defaultMonth}
        onChange={(e) => setValues({ ...values, defaultMonth: e.target.value })}
      >
        <option value="current">Always the current month</option>
        {[...monthOptions].reverse().map((month) => (
          <option key={month} value={month}>
            {monthLabel(month)}
          </option>
        ))}
      </SelectField>

      <div className="flex justify-end pt-1">
        <Button type="submit" variant="primary" loading={saving}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
