'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';

/**
 * Toasts confirm that something was actually saved. They are the only feedback
 * for a successful write, so they say what happened rather than "Done".
 */

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

const TONES = {
  success: { icon: Check, ring: 'text-positive', badge: 'bg-positive-soft text-positive' },
  error: { icon: TriangleAlert, ring: 'text-danger', badge: 'bg-danger-soft text-danger' },
  info: { icon: Info, ring: 'text-accent', badge: 'bg-accent-soft text-accent-ink' },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      // Errors linger, because they usually need reading twice.
      timers.current.set(id, setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 3800));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
      >
        {toasts.map((toast) => {
          const { icon: Icon, badge } = TONES[toast.tone];
          return (
            <div
              key={toast.id}
              className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-lg"
            >
              <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${badge}`}>
                <Icon size={12} strokeWidth={2.5} aria-hidden />
              </span>
              <p className="flex-1 text-sm leading-snug font-medium text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="-m-1 shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-sunken hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
