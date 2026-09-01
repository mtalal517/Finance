import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Icons are SVGs, never emoji.
 *
 * Emoji render differently on every platform, cannot be recoloured or aligned
 * to the type, and carry no accessible name. This test is the guard: it fails
 * if one is reintroduced anywhere the user can see.
 */

const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{24C2}\u{3030}\u{303D}]/u;

/** Typography and currency, which are not icons. */
const ALLOWED = new Set([...'—–‘’“”…·×′″€£¥₨']);

/**
 * The only file allowed to contain emoji: the table that translates icons
 * stored by earlier versions into icon names. Those keys must stay exactly as
 * they were written to the database, or old data loses its icons on upgrade.
 */
const LEGACY_TABLE = 'lib/icons/names.ts';

const ROOTS = ['app', 'components', 'lib'];
const SKIP = new Set(['node_modules', '.next', '.test-build']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('icons', () => {
  it('uses SVG icons everywhere, never emoji', () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        const relative = file.split(path.sep).join('/');
        if (relative === LEGACY_TABLE) continue;

        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            const found = [...line].filter((char) => EMOJI.test(char) && !ALLOWED.has(char));
            if (found.length > 0) {
              offenders.push(`${relative}:${index + 1} contains ${found.join('')}`);
            }
          });
      }
    }

    assert.deepEqual(offenders, [], `Emoji found in UI source:\n${offenders.join('\n')}`);
  });

  it('still translates icons stored by earlier versions', async () => {
    const { resolveIconName } = await import('../lib/icons/names');

    // A file written before the icon set existed stored emoji directly.
    assert.equal(resolveIconName('\u{1F697}'), 'car');
    assert.equal(resolveIconName('\u{1F354}'), 'utensils');
    assert.equal(resolveIconName('\u{1F3E6}'), 'landmark');

    // A current name passes through untouched.
    assert.equal(resolveIconName('piggy-bank'), 'piggy-bank');

    // Anything unrecognised falls back rather than rendering blank.
    assert.equal(resolveIconName('not-a-real-icon'), 'tag');
    assert.equal(resolveIconName(undefined, 'wallet'), 'wallet');
  });
});
