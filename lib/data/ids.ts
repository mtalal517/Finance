import { randomBytes } from 'node:crypto';

/**
 * Id generation. Duplicate ids would silently merge or shadow rows, so every id
 * is checked against the ones already in the file before it is handed out.
 */

export function createId(prefix: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = `${prefix}_${randomBytes(6).toString('hex')}`;
    if (!taken.has(id)) return id;
  }
  // Practically unreachable; keeps the function total rather than throwing.
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}

/** Turns "Debit Card" into "debit-card" for human-readable category/account ids. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) || 'item'
  );
}

export function uniqueSlug(name: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const base = slugify(name);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
