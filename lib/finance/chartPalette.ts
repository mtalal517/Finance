/**
 * Chart colour.
 *
 * The eight hues below are a validated categorical set (adjacent-pair CVD ΔE 9.1,
 * normal-vision ΔE 19.6 on a white card). Three of them sit under 3:1 against
 * white, which is allowed only when identity is also carried by visible text —
 * so every chart here ships a labelled legend listing name, amount and share.
 * Colour is never the only cue.
 *
 * Money-flow colours are bound to the *thing*, not to its rank: income is always
 * blue and expenses always orange, on every chart and in every month.
 */

export const SERIES = {
  income: '#2a78d6',
  expenses: '#eb6834',
  savings: '#1baf7a',
  investments: '#eda100',
} as const;

/** Fixed order — assigned in sequence, never cycled. */
export const CATEGORICAL = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
] as const;

/** Everything past the eighth slice folds into one neutral. */
export const OTHER_COLOR = '#a1a1aa';

/** Kept in step with the theme tokens in `app/globals.css`. */
export const CHART_INK = {
  axis: '#8b8b95',
  grid: '#eef0f2',
  surface: '#ffffff',
} as const;

/**
 * Hands each visible category a colour.
 *
 * Assignment walks `orderedCategoryIds` — the user's own category order, which
 * barely changes — rather than this month's spending ranking, so Transport does
 * not become a different colour just because it moved from third to fourth
 * place when you flip to the previous month.
 */
export function buildCategoryColors(
  orderedCategoryIds: string[],
  visibleIds: Iterable<string>,
): Map<string, string> {
  const visible = new Set(visibleIds);
  const colors = new Map<string, string>();
  let slot = 0;

  for (const id of orderedCategoryIds) {
    if (!visible.has(id)) continue;
    colors.set(id, slot < CATEGORICAL.length ? CATEGORICAL[slot] : OTHER_COLOR);
    slot += 1;
  }

  return colors;
}
