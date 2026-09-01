import 'server-only';
import { MongoClient, type Collection, type Db } from 'mongodb';
import { DataStoreError } from './errors';
import type { FinanceData } from '@/lib/types';

/**
 * The MongoDB connection.
 *
 * Serverless functions are frozen and thawed rather than started fresh, so the
 * client is cached on `globalThis` and reused across invocations. Creating a
 * new client per request would open a new pool every time and exhaust the
 * cluster's connection limit under any real use.
 */

const DB_NAME = process.env.MONGODB_DB?.trim() || 'my-finance';

export const FINANCE_COLLECTION = 'finance';
export const BACKUP_COLLECTION = 'backups';

/** The single document holding everything. `rev` is the concurrency guard. */
export interface StoredDocument {
  _id: string;
  rev: number;
  updatedAt: Date;
  data: FinanceData;
}

export interface BackupDocument {
  name: string;
  label: string;
  createdAt: Date;
  size: number;
  data: FinanceData;
}

interface MongoCache {
  client?: Promise<MongoClient>;
  indexed?: Promise<void>;
}

// Survives module reloads in dev and warm invocations in production.
const cache = globalThis as unknown as { __financeMongo?: MongoCache };
cache.__financeMongo ??= {};

export function connectionUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new DataStoreError(
      'The app is not connected to a database. Set the MONGODB_URI environment variable.',
    );
  }
  return uri;
}

export async function getClient(): Promise<MongoClient> {
  const store = cache.__financeMongo!;

  if (!store.client) {
    const client = new MongoClient(connectionUri(), {
      // Small pool: one user, and serverless wants many short-lived instances
      // each holding as few connections as possible.
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
      retryWrites: true,
    });
    // A rejected promise would otherwise be cached forever, leaving the app
    // permanently broken after one transient network blip.
    store.client = client.connect().catch((error) => {
      store.client = undefined;
      throw new DataStoreError('Could not reach the database.', error);
    });
  }

  return store.client;
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(DB_NAME);
}

export async function financeCollection(): Promise<Collection<StoredDocument>> {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection<StoredDocument>(FINANCE_COLLECTION);
}

export async function backupCollection(): Promise<Collection<BackupDocument>> {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection<BackupDocument>(BACKUP_COLLECTION);
}

/** Runs once per process, not once per request. */
function ensureIndexes(db: Db): Promise<void> {
  const store = cache.__financeMongo!;
  store.indexed ??= (async () => {
    await db.collection(BACKUP_COLLECTION).createIndex({ createdAt: -1 });
    await db.collection(BACKUP_COLLECTION).createIndex({ name: 1 }, { unique: true });
  })().catch((error) => {
    // Index creation is an optimisation, not a correctness requirement — a
    // read-only database user should not take the whole app down.
    store.indexed = undefined;
    console.error('[finance] could not create indexes:', error);
  });
  return store.indexed;
}

/** Used by the tests to drop a cached connection between cases. */
export async function closeConnection(): Promise<void> {
  const store = cache.__financeMongo!;
  const client = store.client;
  store.client = undefined;
  store.indexed = undefined;
  if (client) await (await client).close().catch(() => {});
}
