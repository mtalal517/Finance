'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, History, RotateCcw, Save, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { apiRequest } from '@/lib/client/api';

/**
 * Export, import, backup and restore.
 *
 * Every destructive path takes a backup first, so import, restore and even a
 * full reset can all be walked back from the list below.
 */

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DataSettings({ backups }: { backups: BackupInfo[] }) {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<BackupInfo | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [pendingImport, setPendingImport] = useState<{ name: string; content: string } | null>(null);

  async function createBackup() {
    setBusy('backup');
    const response = await apiRequest<{ name: string }>('/api/data/backups', { method: 'POST' });
    setBusy(null);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success('Backup created.');
    router.refresh();
  }

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('That file is too large to be a finance export.');
      return;
    }
    try {
      const content = await file.text();
      JSON.parse(content); // Fail fast on a file that is not JSON at all.
      setPendingImport({ name: file.name, content });
    } catch {
      toast.error('That file is not valid JSON.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setBusy('import');
    const response = await apiRequest<{ summary: Record<string, number> }>('/api/data/import', {
      method: 'POST',
      body: JSON.parse(pendingImport.content),
    });
    setBusy(null);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    toast.success(`Imported ${response.summary.expenses} transactions and ${response.summary.income} income entries.`);
    setPendingImport(null);
    router.refresh();
  }

  async function confirmRestore() {
    if (!restoring) return;
    setBusy('restore');
    const response = await apiRequest('/api/data/backups/restore', {
      method: 'POST',
      body: { name: restoring.name },
    });
    setBusy(null);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    toast.success('Backup restored.');
    setRestoring(null);
    router.refresh();
  }

  async function confirmReset() {
    setBusy('reset');
    const response = await apiRequest('/api/data/reset', { method: 'POST', body: { confirm: resetConfirm } });
    setBusy(null);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    toast.success('Everything has been reset.');
    setResetOpen(false);
    setResetConfirm('');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap gap-2">
          {/* A plain link, so the browser handles the download itself. */}
          <a
            href="/api/data/export"
            download
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-base font-medium text-ink shadow-xs transition-colors hover:bg-sunken"
          >
            <Download size={16} strokeWidth={1.9} aria-hidden />
            Export data
          </a>
          <Button variant="secondary" icon={Upload} onClick={() => fileInput.current?.click()} loading={busy === 'import'}>
            Import data
          </Button>
          <Button variant="secondary" icon={Save} onClick={createBackup} loading={busy === 'backup'}>
            Create backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onFileChosen(e.target.files?.[0])}
          />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your data lives in MongoDB as a single document. A backup is taken automatically before every change, and the
          ten most recent are kept.
        </p>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-base font-semibold text-ink">
          <History size={15} strokeWidth={1.9} className="text-muted" aria-hidden />
          Backups
        </h3>
        {backups.length === 0 ? (
          <p className="text-sm text-muted">No backups yet. One is created the first time you change something.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {backups.map((backup) => (
              <li key={backup.name} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-ink">{formatWhen(backup.createdAt)}</p>
                  <p className="truncate font-mono text-xs text-muted">
                    {backup.name} · {formatSize(backup.size)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setRestoring(backup)}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-danger/20 bg-danger-soft/40 p-4">
        <h3 className="text-base font-semibold text-danger">Start over</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Deletes every transaction, budget, goal, account and debt, leaving the default categories. A backup is taken
          first, so this can be undone from the list above.
        </p>
        <Button variant="danger" size="sm" icon={RotateCcw} className="mt-3" onClick={() => setResetOpen(true)}>
          Erase all data
        </Button>
      </div>

      <ConfirmDialog
        open={pendingImport !== null}
        title="Replace everything with this file?"
        confirmLabel="Import and replace"
        body={
          pendingImport ? (
            <>
              <strong className="font-medium text-ink">{pendingImport.name}</strong> will replace all of your current
              data. Your existing data is backed up first, so you can restore it afterwards if this is not what you
              wanted.
            </>
          ) : null
        }
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      />

      <ConfirmDialog
        open={restoring !== null}
        title="Restore this backup?"
        confirmLabel="Restore"
        tone="primary"
        body={
          restoring ? (
            <>
              Your data will be replaced with the snapshot from{' '}
              <strong className="font-medium text-ink">{formatWhen(restoring.createdAt)}</strong>. Anything recorded
              since then is lost — though the current state is backed up first.
            </>
          ) : null
        }
        onConfirm={confirmRestore}
        onCancel={() => setRestoring(null)}
      />

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Erase all data?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmReset} loading={busy === 'reset'} disabled={resetConfirm !== 'ERASE'}>
              Erase everything
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-base text-ink-soft">
          <p>
            This removes every transaction, income entry, budget, goal, account and debt. Type{' '}
            <strong className="font-medium text-ink">ERASE</strong> to confirm.
          </p>
          <input
            className="field"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder="ERASE"
            aria-label="Type ERASE to confirm"
          />
        </div>
      </Modal>
    </div>
  );
}
