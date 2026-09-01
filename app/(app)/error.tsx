'use client';

import { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * The last line of defence. The real error goes to the console for whoever is
 * running the app; the page shows a sentence a person can act on.
 */
export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[finance] page failed to render:', error);
  }, [error]);

  return (
    <div className="surface p-8 text-center">
      <span className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-danger-soft text-danger">
        <TriangleAlert size={17} strokeWidth={1.9} aria-hidden />
      </span>
      <h1 className="text-base font-semibold text-ink">This page could not be loaded</h1>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        Nothing has been changed. This is usually the database being unreachable — check that your cluster is running
        and that <code className="font-mono">MONGODB_URI</code> is correct.
      </p>
      <div className="mt-4 flex justify-center">
        <Button variant="primary" icon={RefreshCw} onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
