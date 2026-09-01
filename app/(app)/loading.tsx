/**
 * Shown while a page's data is read. It mirrors the common page shape — header,
 * a strip of figures, then panels — so the layout does not jump when the real
 * content arrives.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="h-6 w-36 rounded-md bg-line" />
          <div className="mt-2 h-4 w-48 rounded bg-line/70" />
        </div>
        <div className="h-9 w-48 rounded-lg bg-line/70" />
      </div>

      <div className="surface overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="bg-surface p-4">
              <div className="h-3 w-14 rounded bg-line/80" />
              <div className="mt-2.5 h-5 w-20 rounded bg-line" />
              <div className="mt-2 h-3 w-16 rounded bg-line/60" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface h-80 lg:col-span-2" />
        <div className="surface h-80" />
      </div>
    </div>
  );
}
