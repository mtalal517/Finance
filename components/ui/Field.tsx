'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown, TriangleAlert } from 'lucide-react';

/**
 * Form controls that show server-side validation errors in place. The `error`
 * string always comes from the API response, never from a parallel client-side
 * rule — one set of rules, enforced where it matters.
 */

interface FieldShellProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldShell({ label, htmlFor, error, hint, required, className = '', children }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium text-ink">
        {label}
        {!required && <span className="text-xs font-normal text-muted">Optional</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-danger">
          <TriangleAlert size={12} strokeWidth={2.25} className="mt-px shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
  className?: string;
}

export function TextField({ label, error, hint, prefix, className, required, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm font-medium text-muted">
            {prefix}
          </span>
        )}
        <input
          {...props}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          className={`field ${prefix ? 'pl-9' : ''} ${props.type === 'number' ? 'tnum' : ''}`}
        />
      </div>
    </FieldShell>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function SelectField({ label, error, hint, className, required, children, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <select
          {...props}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          className="field cursor-pointer appearance-none pr-8"
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
}

export function TextAreaField({ label, error, hint, className, required, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <textarea {...props} id={id} required={required} aria-invalid={error ? true : undefined} className="field resize-y" />
    </FieldShell>
  );
}

/** A form-level error, for failures that are not tied to one field. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
    >
      <TriangleAlert size={14} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
      {message}
    </div>
  );
}
