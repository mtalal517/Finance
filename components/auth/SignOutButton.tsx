'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { apiRequest } from '@/lib/client/api';

export function SignOutButton({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function signOut() {
    setWorking(true);
    await apiRequest('/api/auth/logout', { method: 'POST' });
    onDone?.();
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={working}
      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-base font-medium text-ink-soft transition-colors duration-150 hover:bg-sunken/70 hover:text-ink disabled:opacity-50"
    >
      <LogOut
        size={16}
        strokeWidth={1.9}
        aria-hidden
        className="shrink-0 text-muted transition-colors group-hover:text-ink-soft"
      />
      {working ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
