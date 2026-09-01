/**
 * Icon identity, kept free of React so the data layer and the tests can use it.
 *
 * Categories and accounts store an icon *name*, not a glyph. The name is
 * resolved to an SVG at render time by `lib/icons/registry.tsx`. Storing a name
 * means the icon set can be restyled or replaced without touching stored data.
 */

export const ICON_NAMES = [
  // Everyday spending
  'utensils',
  'coffee',
  'shopping-cart',
  'shopping-bag',
  'shirt',
  'car',
  'fuel',
  'bus',
  'home',
  'zap',
  'wifi',
  'phone',
  'pill',
  'heart-pulse',
  'dumbbell',
  'users',
  'user',
  'baby',
  'graduation-cap',
  'paw-print',
  'gift',
  'plane',
  'film',
  'gamepad-2',
  'music',
  'book',
  'repeat',
  'briefcase',
  'wrench',
  'scissors',
  'heart-handshake',
  'receipt',
  'tag',
  'package',
  // Money that is kept rather than consumed
  'piggy-bank',
  'landmark',
  'trending-up',
  'chart-candlestick',
  'coins',
  // Accounts
  'building-2',
  'banknote',
  'credit-card',
  'smartphone',
  'wallet',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const ICON_NAME_SET = new Set<string>(ICON_NAMES);

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && ICON_NAME_SET.has(value);
}

/** Grouped for the icon picker, so the list reads as something chosen. */
export const ICON_GROUPS: { label: string; icons: IconName[] }[] = [
  {
    label: 'Everyday',
    icons: ['utensils', 'coffee', 'shopping-cart', 'shopping-bag', 'shirt', 'receipt', 'tag', 'package'],
  },
  { label: 'Getting around', icons: ['car', 'fuel', 'bus', 'plane'] },
  { label: 'Home & bills', icons: ['home', 'zap', 'wifi', 'phone', 'wrench', 'repeat'] },
  {
    label: 'Health & people',
    icons: ['pill', 'heart-pulse', 'dumbbell', 'users', 'user', 'baby', 'paw-print', 'heart-handshake'],
  },
  { label: 'Life', icons: ['graduation-cap', 'gift', 'film', 'gamepad-2', 'music', 'book', 'scissors', 'briefcase'] },
  { label: 'Money', icons: ['piggy-bank', 'landmark', 'trending-up', 'chart-candlestick', 'coins'] },
  { label: 'Accounts', icons: ['building-2', 'banknote', 'credit-card', 'smartphone', 'wallet'] },
];

export const DEFAULT_CATEGORY_ICON: IconName = 'tag';
export const DEFAULT_ACCOUNT_ICON: IconName = 'wallet';
export const UNKNOWN_ICON: IconName = 'package';

/**
 * Earlier versions stored an emoji here. Anything still holding one is
 * translated on read, so upgrading does not blank out a single icon.
 */
const LEGACY_EMOJI: Record<string, IconName> = {
  '🍔': 'utensils',
  '🚗': 'car',
  '👨‍👩‍👧': 'users',
  '🏠': 'home',
  '💊': 'pill',
  '🧍': 'user',
  '🛍️': 'shopping-bag',
  '🛍': 'shopping-bag',
  '🎬': 'film',
  '🔁': 'repeat',
  '💼': 'briefcase',
  '📦': 'package',
  '🏦': 'landmark',
  '📈': 'trending-up',
  '🎓': 'graduation-cap',
  '🐾': 'paw-print',
  '🎁': 'gift',
  '💵': 'banknote',
  '💳': 'credit-card',
  '📱': 'smartphone',
  '🪙': 'coins',
  '🏧': 'building-2',
  '📁': 'tag',
  '❓': 'package',
};

/**
 * Turns whatever is stored into a usable icon name: a valid name passes
 * through, a known emoji is translated, and anything else falls back.
 */
export function resolveIconName(value: unknown, fallback: IconName = DEFAULT_CATEGORY_ICON): IconName {
  if (isIconName(value)) return value;
  if (typeof value === 'string') {
    const mapped = LEGACY_EMOJI[value.trim()];
    if (mapped && isIconName(mapped)) return mapped;
  }
  return fallback;
}
