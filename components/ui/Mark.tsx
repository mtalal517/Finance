/**
 * The app's mark: an F whose two arms are chart bars of unequal length.
 *
 * Only the glyph is drawn here — the dark tile behind it belongs to whatever is
 * placing the mark, which is what lets the sidebar and the login screen size it
 * differently without two copies of the shape. It paints in `currentColor`, so
 * the tile sets the colour. `app/icon.svg` is the same geometry with its own
 * tile, since a favicon has to carry one.
 */
export function Mark({ className = 'h-[15px] w-auto' }: { className?: string }) {
  return (
    <svg viewBox="9 7 14 18" className={className} fill="currentColor" aria-hidden>
      <rect x="9" y="7" width="4.5" height="18" rx="1.5" />
      <rect x="14.5" y="7" width="8.5" height="4.5" rx="2.25" />
      <rect x="14.5" y="14.25" width="6" height="4.5" rx="2.25" />
    </svg>
  );
}
