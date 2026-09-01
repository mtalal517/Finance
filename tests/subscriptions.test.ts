import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

/**
 * Subscription persistence, against a real MongoDB for the same reason the
 * store tests are: paying one writes a transaction and advances a date inside a
 * single atomic update, and that is exactly what a mock would get wrong.
 *
 * As in `store.test.ts`, the modules are `require`d inside the hooks so that
 * `MONGODB_URI` is set before the connection module is first loaded.
 */

type Store = typeof import('../lib/data/store');
type Mongo = typeof import('../lib/data/mongo');
type Subscriptions = typeof import('../lib/data/subscriptions');

let memory: MongoMemoryServer;
let client: MongoClient;
let store: Store;
let mongo: Mongo;
let subscriptions: Subscriptions;

before(async () => {
  memory = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memory.getUri();
  process.env.MONGODB_DB = 'subscriptions-test';

  client = new MongoClient(memory.getUri());
  await client.connect();

  store = require('../lib/data/store') as Store;
  mongo = require('../lib/data/mongo') as Mongo;
  subscriptions = require('../lib/data/subscriptions') as Subscriptions;
});

after(async () => {
  await mongo.closeConnection();
  await client.close();
  await memory.stop();
});

async function resetDatabase() {
  const db = client.db('subscriptions-test');
  await db.collection('finance').deleteMany({});
  await db.collection('backups').deleteMany({});
}

const NETFLIX = {
  name: 'Netflix',
  amount: 1_200,
  cycle: 'monthly',
  nextDueDate: '2026-09-05',
  categoryId: 'subscriptions',
  accountId: 'bank',
  icon: 'repeat',
  active: true,
  notes: '',
};

describe('subscription records', () => {
  beforeEach(resetDatabase);

  it('creates one and gives it an id', async () => {
    const created = await subscriptions.createSubscription(NETFLIX);

    assert.match(created.id, /^sub_/);
    assert.equal(created.name, 'Netflix');
    assert.equal(created.amount, 1_200);

    const data = await store.readData();
    assert.equal(data.subscriptions.length, 1);
  });

  it('refuses a subscription whose category does not exist', async () => {
    await assert.rejects(
      () => subscriptions.createSubscription({ ...NETFLIX, categoryId: 'nope' }),
      // Errors come back keyed by field, as they do for every other mutation.
      (error: unknown) => {
        const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
        assert.match(fieldErrors.categoryId ?? '', /category/i);
        return true;
      },
    );
  });

  it('edits the fields without moving the id or the created date', async () => {
    const created = await subscriptions.createSubscription(NETFLIX);
    const updated = await subscriptions.updateSubscription(created.id, {
      ...NETFLIX,
      name: 'Netflix Premium',
      amount: 1_500,
    });

    assert.equal(updated.id, created.id);
    assert.equal(updated.createdAt, created.createdAt);
    assert.equal(updated.name, 'Netflix Premium');
    assert.equal(updated.amount, 1_500);
  });
});

describe('paying a subscription', () => {
  beforeEach(resetDatabase);

  it('writes one transaction against its own category, account and due date', async () => {
    const created = await subscriptions.createSubscription(NETFLIX);

    const { transaction } = await subscriptions.paySubscription(created.id);
    const data = await store.readData();

    assert.equal(data.expenses.length, 1);
    assert.equal(transaction.amount, 1_200);
    assert.equal(transaction.categoryId, 'subscriptions');
    assert.equal(transaction.accountId, 'bank');
    assert.equal(transaction.date, '2026-09-05', 'charged on the day it fell due');
    assert.equal(transaction.direction, 'out');
    assert.equal(transaction.subscriptionId, created.id, 'linked back to the subscription');
    assert.match(transaction.description, /Netflix/);
  });

  it('moves the due date on by one billing cycle', async () => {
    const created = await subscriptions.createSubscription(NETFLIX);

    const { subscription } = await subscriptions.paySubscription(created.id);

    assert.equal(subscription.nextDueDate, '2026-10-05');
  });

  it('moves a yearly subscription on by a year', async () => {
    const created = await subscriptions.createSubscription({
      ...NETFLIX,
      cycle: 'yearly',
      nextDueDate: '2026-09-05',
    });

    const { subscription } = await subscriptions.paySubscription(created.id);

    assert.equal(subscription.nextDueDate, '2027-09-05');
  });

  it('charges each period once when paid twice', async () => {
    const created = await subscriptions.createSubscription(NETFLIX);

    const first = await subscriptions.paySubscription(created.id);
    const second = await subscriptions.paySubscription(created.id);

    assert.equal(first.transaction.date, '2026-09-05');
    assert.equal(second.transaction.date, '2026-10-05', 'the second pays the next period');

    const data = await store.readData();
    assert.equal(data.expenses.length, 2);
  });

  it('will not pay a paused subscription', async () => {
    const created = await subscriptions.createSubscription({ ...NETFLIX, active: false });

    await assert.rejects(() => subscriptions.paySubscription(created.id), /paused/i);

    const data = await store.readData();
    assert.equal(data.expenses.length, 0, 'and writes nothing');
  });
});

describe('deleting a subscription', () => {
  beforeEach(resetDatabase);

  it('keeps the payments already made, because that money did leave', async () => {
    const created = await subscriptions.createSubscription(NETFLIX);
    await subscriptions.paySubscription(created.id);

    await subscriptions.deleteSubscription(created.id);
    const data = await store.readData();

    assert.equal(data.subscriptions.length, 0);
    assert.equal(data.expenses.length, 1, 'the charge stays on the record');
    assert.equal(data.expenses[0].subscriptionId, null, 'with the dangling link dropped');
  });
});
