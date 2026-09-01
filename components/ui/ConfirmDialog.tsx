'use client';

import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Every destructive action goes through this. It names the specific thing being
 * removed and what happens to what depends on it, rather than asking "Are you
 * sure?" — so a misclick is obvious before it is confirmed.
 */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);

  async function confirm() {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={working ? () => {} : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={working}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={confirm} loading={working} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-base leading-relaxed text-ink-soft">{body}</div>
    </Modal>
  );
}
