import Link from 'next/link';
import { Compass } from 'lucide-react';

/**
 * The 404 for URLs that match no route at all. It renders outside the app
 * shell, so it centres itself rather than relying on the sidebar layout.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="surface w-full max-w-sm p-8 text-center">
        <span className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-sunken text-muted">
          <Compass size={17} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="text-base font-semibold text-ink">Nothing here</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          That page does not exist. It may have been deleted or renamed.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-base font-medium text-white shadow-xs transition-colors hover:bg-primary-hover"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
