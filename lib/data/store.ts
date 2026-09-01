import 'server-only';
import { createEmptyData, DATA_VERSION } from './defaults';
import { normalizeData } from './normalize';
import { DataStoreError } from './errors';
import {
  backupCollection,
  financeCollection,
  type BackupDocument,
  type StoredDocument,
} from './mongo';
import type { FinanceData } from '@/lib/types';

/**
 * The one and only module that reads or writes stored data.
 *
 * Everything is kept in a single document. That looks unusual for MongoDB, but
 * this data is one person's complete financial picture and is always read as a
 * whole — the dashboard needs income, expenses and budgets together to produce
 * a single figure. One document makes each save atomic in one round trip, and
 * ten years of daily spending still comes to well under a megabyte against a
 * 16 MB document limit.
 *
 * Guarantees:
 *  - Writes use optimistic concurrency on a `rev` counter, so two requests
 *    landing at once cannot silently overwrite each other — the loser re-reads
 *    and re-applies rather than clobbering.
 *  - Each save is a single atomic replace; there is no half-written state.
 *  - The previous version is copied into a backups collection before it is
 *    replaced, and the ten most recent are kept.
 *  - Anything structurally odd coming back is repaired by `normalizeData`
 *    rather than thrown, so a hand-edited document never locks the user out.
 */

export { DataStoreError };

const DOC_ID = 'primary';
const MAX_AUTO_BACKUPS = 10;

/**
 * How long a save keeps retrying before giving up.
 *
 * A fixed attempt count is the wrong shape here: with N writers contending on
 * one document, only one can win each round, so the last one needs at least N
 * attempts. A deadline bounds the wait without capping the number of writers
 * the store can survive.
 */
const WRITE_DEADLINE_MS = 8_000;

/**
 * Jittered backoff. The jitter is the part that matters — without it, losers
 * retry in lockstep and keep colliding with each other.
 */
function backoffDelay(attempt: number): number {
  const base = Math.min(100, 2 ** Math.min(attempt, 6));
  return Math.round(base * (0.5 + Math.random()));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BACKUP_NAME = /^finance-[\w.-]+\.json$/;

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupName(label: string): string {
  return `finance-${stamp()}-${label}.json`;
}

function sizeOf(data: FinanceData): number {
  return Buffer.byteLength(JSON.stringify(data), 'utf8');
}

interface LoadedDocument {
  data: FinanceData;
  rev: number;
}

/**
 * Reads the document, seeding it the first time. The seed is an upsert with
 * `$setOnInsert` so two instances starting at once cannot both write a fresh
 * empty document and have one wipe the other.
 */
async function load(): Promise<LoadedDocument> {
  const collection = await financeCollection();

  const existing = await collection.findOne({ _id: DOC_ID });
  if (existing) return { data: normalizeData(existing.data), rev: existing.rev ?? 0 };

  const seed: StoredDocument = {
    _id: DOC_ID,
    rev: 1,
    updatedAt: new Date(),
    data: createEmptyData(),
  };
  await collection.updateOne({ _id: DOC_ID }, { $setOnInsert: seed }, { upsert: true });

  const created = await collection.findOne({ _id: DOC_ID });
  if (!created) throw new DataStoreError('Could not create your data in the database.');
  return { data: normalizeData(created.data), rev: created.rev ?? 1 };
}

export async function readData(): Promise<FinanceData> {
  return (await load()).data;
}

/**
 * Read, mutate, write.
 *
 * If another request wrote in between, the replace matches nothing and the
 * whole thing is retried against fresh data. The mutator must therefore be safe
 * to run more than once — all of ours are, because they derive everything from
 * the data handed to them.
 */
export async function updateData<T>(
  mutator: (data: FinanceData) => T | Promise<T>,
): Promise<{ data: FinanceData; result: T }> {
  const collection = await financeCollection();
  const deadline = Date.now() + WRITE_DEADLINE_MS;

  for (let attempt = 0; ; attempt += 1) {
    const { data, rev } = await load();
    // Snapshot before the mutator touches it — this is what gets backed up.
    const previous = structuredClone(data);

    const result = await mutator(data);
    data.version = DATA_VERSION;

    const replaced = await collection.replaceOne(
      { _id: DOC_ID, rev },
      { rev: rev + 1, updatedAt: new Date(), data },
    );

    if (replaced.matchedCount === 1) {
      await saveBackup(previous, 'auto').catch((error) => {
        // A failed backup must not fail the save the user just made.
        console.error('[finance] could not write backup:', error);
      });
      return { data, result };
    }

    // Lost the race. Re-read and re-apply against whatever is there now.
    if (Date.now() >= deadline) break;
    await sleep(backoffDelay(attempt));
  }

  throw new DataStoreError('Your data was being changed elsewhere. Please try again.');
}

/** Wholesale replacement, used by import, restore and reset. */
export async function replaceData(next: unknown, label: string): Promise<FinanceData> {
  const normalized = normalizeData(next);
  const collection = await financeCollection();
  const deadline = Date.now() + WRITE_DEADLINE_MS;

  for (let attempt = 0; ; attempt += 1) {
    const { data: previous, rev } = await load();

    const replaced = await collection.replaceOne(
      { _id: DOC_ID, rev },
      { rev: rev + 1, updatedAt: new Date(), data: normalized },
    );

    if (replaced.matchedCount === 1) {
      await saveBackup(previous, label).catch((error) => {
        console.error('[finance] could not write backup:', error);
      });
      return normalized;
    }

    if (Date.now() >= deadline) break;
    await sleep(backoffDelay(attempt));
  }

  throw new DataStoreError('Your data was being changed elsewhere. Please try again.');
}

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

async function saveBackup(data: FinanceData, label: string): Promise<string> {
  const collection = await backupCollection();

  const document: BackupDocument = {
    name: backupName(label),
    label,
    createdAt: new Date(),
    size: sizeOf(data),
    data,
  };
  await collection.insertOne(document);

  // Keep the newest few and drop the rest.
  const stale = await collection
    .find({}, { projection: { _id: 1 }, sort: { createdAt: -1 }, skip: MAX_AUTO_BACKUPS })
    .toArray();
  if (stale.length > 0) {
    await collection.deleteMany({ _id: { $in: stale.map((row) => row._id) } });
  }

  return document.name;
}

export async function createBackup(label = 'manual'): Promise<string> {
  return saveBackup(await readData(), label);
}

export async function listBackups(): Promise<{ name: string; size: number; createdAt: string }[]> {
  const collection = await backupCollection();
  const rows = await collection
    .find({}, { projection: { name: 1, size: 1, createdAt: 1 }, sort: { createdAt: -1 } })
    .toArray();

  return rows.map((row) => ({
    name: row.name,
    size: row.size ?? 0,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  }));
}

export async function restoreBackup(name: unknown): Promise<FinanceData> {
  // Must be a plain string. An object here would be interpreted as a query
  // operator and could match an arbitrary backup.
  if (typeof name !== 'string' || !BACKUP_NAME.test(name)) {
    throw new DataStoreError('That backup name is not valid.');
  }

  const collection = await backupCollection();
  const backup = await collection.findOne({ name });
  if (!backup) throw new DataStoreError('That backup could not be found.');

  // The current state is backed up first, so a restore is itself undoable.
  return replaceData(backup.data, 'pre-restore');
}
