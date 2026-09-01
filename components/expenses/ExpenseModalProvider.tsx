'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  emptyFormValues,
  ExpenseForm,
  ExpenseFormSubmit,
  toFormValues,
  type ExpenseFormValues,
} from './ExpenseForm';
import type { Transaction } from '@/lib/types';

/**
 * Hosts the global expense dialog once, at the shell level, so "+ Add Expense"
 * works identically from the sidebar, the mobile header and any page — and so
 * only one dialog can ever be open.
 */

interface ExpenseModalApi {
  addExpense: (defaults?: Partial<ExpenseFormValues>) => void;
  editExpense: (transaction: Transaction) => void;
}

const ExpenseModalContext = createContext<ExpenseModalApi | null>(null);

export function useExpenseModal(): ExpenseModalApi {
  const api = useContext(ExpenseModalContext);
  if (!api) throw new Error('useExpenseModal must be used inside <ExpenseModalProvider>');
  return api;
}

interface ModalState {
  values: ExpenseFormValues;
  transactionId?: string;
}

export function ExpenseModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const api = useMemo<ExpenseModalApi>(
    () => ({
      addExpense: (defaults) => setState({ values: emptyFormValues(defaults) }),
      editExpense: (transaction) =>
        setState({ values: toFormValues(transaction), transactionId: transaction.id }),
    }),
    [],
  );

  const close = useCallback(() => {
    if (submitting) return; // Never yank the dialog away mid-save.
    setState(null);
  }, [submitting]);

  const editing = Boolean(state?.transactionId);

  return (
    <ExpenseModalContext.Provider value={api}>
      {children}
      <Modal
        open={state !== null}
        onClose={close}
        title={editing ? 'Edit transaction' : 'Add expense'}
        description={
          editing
            ? 'Changes apply everywhere this transaction is counted.'
            : 'Recorded against the category budget for the month you choose.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <ExpenseFormSubmit
              formId="expense-modal-form"
              submitting={submitting}
              label={editing ? 'Save changes' : 'Add expense'}
            />
          </>
        }
      >
        {state && (
          <ExpenseForm
            // Remounts the form for each open, so it never shows the last entry.
            key={state.transactionId ?? 'new'}
            formId="expense-modal-form"
            initial={state.values}
            transactionId={state.transactionId}
            onSaved={() => setState(null)}
            onSubmittingChange={setSubmitting}
          />
        )}
      </Modal>
    </ExpenseModalContext.Provider>
  );
}
