/**
 * Storage-layer failures. Kept in its own module so `mongo.ts` and `store.ts`
 * can both use it without importing each other.
 */
export class DataStoreError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DataStoreError';
    this.cause = cause;
  }
}
