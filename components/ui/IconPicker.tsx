'use client';

import { ICON_GROUPS, type IconName } from '@/lib/icons/names';
import { iconFor } from '@/lib/icons/registry';

/** Picks the icon stored against a category or an account. */
export function IconPicker({
  value,
  onChange,
  label = 'Icon',
}: {
  value: string;
  onChange: (icon: IconName) => void;
  label?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="max-h-52 space-y-3 overflow-y-auto rounded-lg border border-line bg-sunken/40 p-3">
        {ICON_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="label mb-1.5">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.icons.map((name) => {
                const Icon = iconFor(name);
                const selected = value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onChange(name)}
                    aria-pressed={selected}
                    aria-label={name.replace(/-/g, ' ')}
                    title={name.replace(/-/g, ' ')}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                      selected
                        ? 'border-ink bg-primary text-white'
                        : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.9} aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
