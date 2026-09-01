'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormError, SelectField, TextField } from '@/components/ui/Field';
import { Badge, IconTile } from '@/components/ui/Primitives';
import { IconPicker } from '@/components/ui/IconPicker';
import { apiRequest } from '@/lib/client/api';
import { iconFor } from '@/lib/icons/registry';
import { DEFAULT_CATEGORY_ICON, type IconName } from '@/lib/icons/names';
import type { Category, CategoryType } from '@/lib/types';

/**
 * Category management.
 *
 * Deleting a category that has transactions is refused until the user says what
 * should happen to them — move them elsewhere, or delete them too. The server
 * enforces that; this dialog makes the choice explicit.
 */

export interface CategoryUsageInfo {
  id: string;
  transactions: number;
  budgets: number;
}

interface CategoryValues {
  name: string;
  type: CategoryType;
  icon: string;
}

const TYPE_LABEL: Record<CategoryType, string> = {
  expense: 'Spending',
  savings: 'Savings',
  investment: 'Investment',
};

const TYPE_TONE = { expense: 'neutral', savings: 'positive', investment: 'accent' } as const;

export function CategorySettings({ categories, usage }: { categories: Category[]; usage: CategoryUsageInfo[] }) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<{ id?: string; values: CategoryValues } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [strategy, setStrategy] = useState<'reassign' | 'delete-transactions'>('reassign');
  const [reassignTo, setReassignTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const usageFor = (id: string) => usage.find((u) => u.id === id) ?? { id, transactions: 0, budgets: 0 };

  function openAdd() {
    setFormError(null);
    setFieldErrors({});
    setEditing({ values: { name: '', type: 'expense', icon: DEFAULT_CATEGORY_ICON } });
  }

  function openEdit(category: Category) {
    setFormError(null);
    setFieldErrors({});
    setEditing({ id: category.id, values: { name: category.name, type: category.type, icon: category.icon } });
  }

  function openDelete(category: Category) {
    setFormError(null);
    setStrategy('reassign');
    setReassignTo(categories.find((c) => c.id !== category.id)?.id ?? '');
    setDeleting(category);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const response = await apiRequest<{ category: Category }>(
      editing.id ? `/api/categories/${editing.id}` : '/api/categories',
      { method: editing.id ? 'PUT' : 'POST', body: editing.values },
    );

    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      setFieldErrors(response.fieldErrors ?? {});
      return;
    }

    toast.success(editing.id ? 'Category updated.' : 'Category added.');
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting || saving) return;

    const info = usageFor(deleting.id);
    setSaving(true);
    setFormError(null);

    const query =
      info.transactions > 0
        ? `?strategy=${strategy}${strategy === 'reassign' ? `&reassignTo=${encodeURIComponent(reassignTo)}` : ''}`
        : '';

    const response = await apiRequest(`/api/categories/${deleting.id}${query}`, { method: 'DELETE' });
    setSaving(false);

    if (!response.ok) {
      setFormError(response.error);
      return;
    }

    toast.success('Category deleted.');
    setDeleting(null);
    router.refresh();
  }

  const deletingUsage = deleting ? usageFor(deleting.id) : null;

  return (
    <>
      <ul className="divide-y divide-line border-y border-line">
        {categories.map((category) => {
          const info = usageFor(category.id);
          const Icon = iconFor(category.icon);
          return (
            <li key={category.id} className="group flex items-center gap-3 py-2.5">
              <IconTile icon={Icon} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-base font-medium text-ink">
                  {category.name}
                  <Badge tone={TYPE_TONE[category.type]}>{TYPE_LABEL[category.type]}</Badge>
                </p>
                <p className="text-sm text-muted">
                  {info.transactions} transaction{info.transactions === 1 ? '' : 's'}
                  {info.budgets > 0 && ` · budgeted in ${info.budgets} month${info.budgets === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={Pencil}
                  aria-label={`Edit ${category.name}`}
                  onClick={() => openEdit(category)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={Trash2}
                  aria-label={`Delete ${category.name}`}
                  onClick={() => openDelete(category)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <Button variant="secondary" icon={Plus} onClick={openAdd}>
          Add category
        </Button>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit category' : 'New category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" variant="primary" loading={saving}>
              {editing?.id ? 'Save changes' : 'Add category'}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="category-form" onSubmit={save} noValidate className="space-y-4">
            <FormError message={formError} />
            <TextField
              label="Name"
              required
              maxLength={60}
              placeholder="Education"
              value={editing.values.name}
              error={fieldErrors.name}
              onChange={(e) => setEditing({ ...editing, values: { ...editing.values, name: e.target.value } })}
            />
            <SelectField
              label="Type"
              required
              hint="Savings and investment are kept out of your spending totals."
              value={editing.values.type}
              error={fieldErrors.type}
              onChange={(e) =>
                setEditing({ ...editing, values: { ...editing.values, type: e.target.value as CategoryType } })
              }
            >
              {(Object.keys(TYPE_LABEL) as CategoryType[]).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </SelectField>
            <IconPicker
              value={editing.values.icon}
              onChange={(icon: IconName) => setEditing({ ...editing, values: { ...editing.values, icon } })}
            />
          </form>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => !saving && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'category'}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={saving}
              disabled={
                deletingUsage !== null && deletingUsage.transactions > 0 && strategy === 'reassign' && !reassignTo
              }
            >
              Delete category
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-base text-ink-soft">
          <FormError message={formError} />

          {deletingUsage && deletingUsage.transactions > 0 ? (
            <>
              <p>
                <strong className="font-medium text-ink">{deletingUsage.transactions}</strong> transaction
                {deletingUsage.transactions === 1 ? '' : 's'} use this category. Choose what happens to them.
              </p>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3 transition-colors hover:bg-sunken has-checked:border-ink has-checked:bg-sunken">
                  <input
                    type="radio"
                    name="delete-strategy"
                    className="mt-0.5 accent-[var(--color-primary)]"
                    checked={strategy === 'reassign'}
                    onChange={() => setStrategy('reassign')}
                  />
                  <span>
                    <span className="block text-base font-medium text-ink">Move them to another category</span>
                    <span className="block text-sm text-muted">Your spending history and totals stay intact.</span>
                  </span>
                </label>

                {strategy === 'reassign' && (
                  <SelectField
                    label="Move transactions into"
                    required
                    value={reassignTo}
                    onChange={(e) => setReassignTo(e.target.value)}
                  >
                    {categories
                      .filter((c) => c.id !== deleting?.id)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </SelectField>
                )}

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3 transition-colors hover:bg-sunken has-checked:border-danger has-checked:bg-danger-soft">
                  <input
                    type="radio"
                    name="delete-strategy"
                    className="mt-0.5 accent-[var(--color-danger)]"
                    checked={strategy === 'delete-transactions'}
                    onChange={() => setStrategy('delete-transactions')}
                  />
                  <span>
                    <span className="block text-base font-medium text-ink">Delete the transactions too</span>
                    <span className="block text-sm text-muted">
                      That spending disappears from every total and every month. This cannot be undone.
                    </span>
                  </span>
                </label>
              </div>
            </>
          ) : (
            <p>Nothing is using this category, so it can be removed safely.</p>
          )}
        </div>
      </Modal>
    </>
  );
}
