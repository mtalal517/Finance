import { Unplug } from 'lucide-react';

/**
 * Shown when the app has no database configured. Without this the first run is
 * a generic "something went wrong", which says nothing about the one variable
 * you actually need to set.
 */
export function SetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="surface w-full max-w-lg p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <Unplug size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-ink">No database configured</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              This app stores your finances in MongoDB. Set <code className="font-mono">MONGODB_URI</code> and restart
              it.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-line bg-sunken/60 p-4">
          <p className="label">Locally</p>
          <pre className="mt-2 overflow-x-auto font-mono text-xs leading-relaxed text-ink-soft">
{`cp .env.example .env.local
# then set MONGODB_URI in .env.local
npm run dev`}
          </pre>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          A free MongoDB Atlas cluster is enough — this app keeps everything in one document, well under the free
          tier&rsquo;s 512 MB. On a host, set the same variable in its environment settings.
        </p>
      </div>
    </main>
  );
}
