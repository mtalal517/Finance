'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpenseModal } from '@/components/expenses/ExpenseModalProvider';

/** Opens the global expense dialog pre-filled for one category and month. */
export function AddInCategoryButton({
  categoryId,
  categoryName,
  defaultDate,
}: {
  categoryId: string;
  categoryName: string;
  defaultDate: string;
}) {
  const { addExpense } = useExpenseModal();
  return (
    <Button variant="primary" icon={Plus} onClick={() => addExpense({ categoryId, date: defaultDate })}>
      Add to {categoryName.toLowerCase()}
    </Button>
  );
}
