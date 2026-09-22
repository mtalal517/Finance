import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

/**
 * Persistence tests, run against a real MongoDB instance rather than a mock —
 * optimistic concurrency and upsert semantics are exactly the things a mock
 * would get wrong.
 *
 * The store reads `MONGODB_URI` when it first connects, so the server is
 * started and the variable set *before* the module is loaded. That is why this
 * file uses `require` inside the hooks rather than a top-level import.
 */

type Store = typeof import('../lib/data/store');
type Mongo = typeof import('../lib/data/mongo');

let memory: MongoMemoryServer;
let client: MongoClient;
let store: Store;
let mongo: Mongo;

before(async () => {
  memory = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memory.getUri();
  process.env.MONGODB_DB = 'finance-test';

  client = new MongoClient(memory.getUri());
  await client.connect();

  store = require('../lib/data/store') as Store;
  mongo = require('../lib/data/mongo') as Mongo;
});

after(async () => {
  await mongo.closeConnection();
  await client.close();
  await memory.stop();
});

/**
 * A `beforeEach` registered at the top level of the file fires once per suite,
 * not once per test, so each `describe` registers its own.
 */
async function resetDatabase() {
  const db = client.db('finance-test');
  await db.collection('finance').deleteMany({});
  await db.collection('backups').deleteMany({});
}

function financeDoc() {
  return client.db('finance-test').collection('finance').findOne({ _id: 'primary' as never });
}

function newExpense(id: string, amount: number) {
  return {
    id,
    amount,
    categoryId: 'food',
    date: '2026-09-01',
    description: `entry ${id}`,
    accountId: null,
    notes: '',
    direction: 'out' as const,
    debtId: null,
    subscriptionId: null,
    goalId: null,
    createdAt: new Date().toISOString(),
  };
}

describe('reading', () => {
  beforeEach(resetDatabase);

  it('seeds a usable document the first time', async () => {
    const data = await store.readData();

    assert.ok(data.categories.length > 0, 'seeds default categories');
    assert.ok(data.accounts.length > 0, 'seeds default accounts');
    assert.deepEqual(data.expenses, []);

    const stored = await financeDoc();
    assert.ok(stored, 'and persists it');
    assert.equal(stored!.data.categories.length, data.categories.length);
  });

  it('does not reseed over existing data', async () => {
    await store.updateData((data) => {
      data.expenses.push(newExpense('exp_keep', 700));
    });

    const reread = await store.readData();
    assert.equal(reread.expenses.length, 1);
    assert.equal(reread.expenses[0].description, 'entry exp_keep');
  });

  it('repairs a document whose arrays are missing or the wrong type', async () => {
    await client
      .db('finance-test')
      .collection('finance')
      .insertOne({ _id: 'primary' as never, rev: 1, updatedAt: new Date(), data: { expenses: 'nope', categories: null } });

    const data = await store.readData();
    assert.deepEqual(data.expenses, []);
    assert.ok(data.categories.length > 0);
  });

  it('drops rows that cannot be repaired instead of failing everything', async () => {
    await client
      .db('finance-test')
      .collection('finance')
      .insertOne({
        _id: 'primary' as never,
        rev: 1,
        updatedAt: new Date(),
        data: {
          categories: [{ id: 'food', name: 'Food', type: 'expense', icon: '🍔' }],
          expenses: [
            { id: 'good', amount: 100, categoryId: 'food', date: '2026-09-01' },
            { id: 'bad-amount', amount: -5, categoryId: 'food', date: '2026-09-01' },
            { id: 'bad-category', amount: 50, categoryId: 'ghost', date: '2026-09-01' },
          ],
        },
      });

    const data = await store.readData();
    assert.deepEqual(
      data.expenses.map((t) => t.id),
      ['good'],
    );
  });

  it('unlinks an expense from a goal that no longer exists but keeps the row', async () => {
    await client
      .db('finance-test')
      .collection('finance')
      .insertOne({
        _id: 'primary' as never,
        rev: 1,
        updatedAt: new Date(),
        data: {
          categories: [{ id: 'food', name: 'Food', type: 'expense', icon: 'utensils' }],
          goals: [{ id: 'g1', name: 'Medical', targetAmount: 1000, initialAmount: 0, contributions: [] }],
          expenses: [
            { id: 'linked', amount: 100, categoryId: 'food', date: '2026-09-01', goalId: 'g1' },
            { id: 'orphan', amount: 100, categoryId: 'food', date: '2026-09-01', goalId: 'gone' },
          ],
        },
      });

    const data = await store.readData();
    assert.deepEqual(
      data.expenses.map((t) => [t.id, t.goalId]),
      [
        ['linked', 'g1'],
        ['orphan', null],
      ],
    );
  });

  it('drops a transfer whose account is gone and forgets an unknown category', async () => {
    await client
      .db('finance-test')
      .collection('finance')
      .insertOne({
        _id: 'primary' as never,
        rev: 1,
        updatedAt: new Date(),
        data: {
          categories: [{ id: 'food', name: 'Food', type: 'expense', icon: 'utensils' }],
          accounts: [
            { id: 'bank', name: 'Bank', icon: 'landmark', openingBalance: 0 },
            { id: 'cash', name: 'Cash', icon: 'banknote', openingBalance: 0 },
          ],
          transfers: [
            { id: 'ok', fromAccountId: 'bank', toAccountId: 'cash', amount: 100, date: '2026-09-01', categoryId: 'ghost' },
            { id: 'orphan', fromAccountId: 'bank', toAccountId: 'gone', amount: 100, date: '2026-09-01' },
            { id: 'self', fromAccountId: 'bank', toAccountId: 'bank', amount: 100, date: '2026-09-01' },
          ],
        },
      });

    const data = await store.readData();
    assert.deepEqual(
      data.transfers.map((t) => [t.id, t.categoryId]),
      [['ok', null]],
    );
  });
});

describe('writing', () => {
  beforeEach(resetDatabase);

  it('persists a change and advances the revision', async () => {
    await store.readData(); // seed
    const before = (await financeDoc())!.rev;

    await store.updateData((data) => {
      data.expenses.push(newExpense('exp_persist', 700));
    });

    const after = await financeDoc();
    assert.equal(after!.rev, before + 1, 'each save bumps the concurrency guard');
    assert.equal(after!.data.expenses.length, 1);
    assert.equal((await store.readData()).expenses[0].description, 'entry exp_persist');
  });

  it('does not apply a change when the mutator throws', async () => {
    await store.updateData((data) => {
      data.settings.currency = 'PKR';
    });

    await assert.rejects(
      store.updateData(() => {
        throw new Error('nope');
      }),
    );

    const data = await store.readData();
    assert.equal(data.settings.currency, 'PKR', 'and the store keeps working afterwards');
  });

  it('serialises concurrent writes instead of losing them', async () => {
    await store.readData();

    // Fired together on purpose. Without the rev check these all read the same
    // starting state and the last writer would erase the other twenty-four.
    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        store.updateData((data) => {
          data.expenses.push(newExpense(`exp_${index}`, index + 1));
        }),
      ),
    );

    const data = await store.readData();
    assert.equal(data.expenses.length, 25, 'every concurrent write survives');
    assert.equal(new Set(data.expenses.map((t) => t.id)).size, 25, 'and none collide');
  });

  it('re-applies a mutation that lost the race rather than overwriting', async () => {
    await store.readData();

    let interfered = false;
    await store.updateData(async (data) => {
      // Simulate another instance saving in the middle of this one.
      if (!interfered) {
        interfered = true;
        await client
          .db('finance-test')
          .collection('finance')
          .updateOne({ _id: 'primary' as never }, { $inc: { rev: 1 }, $push: { 'data.expenses': newExpense('exp_other', 999) as never } });
      }
      data.expenses.push(newExpense('exp_mine', 111));
    });

    const data = await store.readData();
    const ids = data.expenses.map((t) => t.id).sort();
    assert.deepEqual(ids, ['exp_mine', 'exp_other'], 'both writes are present');
  });
});

describe('backups', () => {
  beforeEach(resetDatabase);

  it('snapshots the previous state before each save', async () => {
    await store.updateData((data) => {
      data.settings.currency = 'FIRST';
    });
    await store.updateData((data) => {
      data.settings.currency = 'SECOND';
    });

    const backups = await store.listBackups();
    assert.ok(backups.length >= 2);
    assert.ok(backups[0].size > 0);
    assert.ok(Date.parse(backups[0].createdAt) > 0);
  });

  it('creates, lists and restores a snapshot', async () => {
    await store.updateData((data) => {
      data.settings.currency = 'SNAPSHOT';
    });
    const name = await store.createBackup('manual');

    await store.updateData((data) => {
      data.settings.currency = 'CHANGED';
    });
    assert.equal((await store.readData()).settings.currency, 'CHANGED');

    assert.ok((await store.listBackups()).some((backup) => backup.name === name));

    await store.restoreBackup(name);
    assert.equal((await store.readData()).settings.currency, 'SNAPSHOT');
  });

  it('keeps only the ten most recent', async () => {
    for (let i = 0; i < 14; i += 1) {
      await store.updateData((data) => {
        data.expenses.push(newExpense(`exp_${i}`, i + 1));
      });
    }
    assert.equal((await store.listBackups()).length, 10);
  });

  it('rejects a name that is not a plain valid string', async () => {
    await assert.rejects(() => store.restoreBackup('../secrets.json'));
    await assert.rejects(() => store.restoreBackup('finance-nope.txt'));
    await assert.rejects(() => store.restoreBackup(''));
    // An object here would be read as a query operator and could match any
    // backup at all, so it must be refused outright.
    await assert.rejects(() => store.restoreBackup({ $ne: null }));
    await assert.rejects(() => store.restoreBackup(undefined));
  });
});

describe('replacing everything', () => {
  beforeEach(resetDatabase);

  it('imports a document and backs up what it replaced', async () => {
    await store.updateData((data) => {
      data.settings.currency = 'BEFORE';
    });

    const imported = await store.replaceData(
      { settings: { currency: 'AFTER', currencySymbol: '$' }, expenses: [], categories: [], accounts: [] },
      'pre-import',
    );

    assert.equal(imported.settings.currency, 'AFTER');
    assert.equal((await store.readData()).settings.currency, 'AFTER');
    assert.ok(
      (await store.listBackups()).some((backup) => backup.name.includes('pre-import')),
      'the replaced state is recoverable',
    );
  });
});
