import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

/**
 * Money added to an account, against a real MongoDB.
 *
 * As in `store.test.ts`, the modules are `require`d inside the hooks so that
 * `MONGODB_URI` is set before the connection module is first loaded.
 */

type Store = typeof import('../lib/data/store');
type Mongo = typeof import('../lib/data/mongo');
type Deposits = typeof import('../lib/data/deposits');
type Accounts = typeof import('../lib/data/accounts');
type Categories = typeof import('../lib/data/categories');
type Calculations = typeof import('../lib/finance/calculations');

let memory: MongoMemoryServer;
let client: MongoClient;
let store: Store;
let mongo: Mongo;
let deposits: Deposits;
let accounts: Accounts;
let categories: Categories;
let calculations: Calculations;

before(async () => {
  memory = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memory.getUri();
  process.env.MONGODB_DB = 'deposits-test';

  client = new MongoClient(memory.getUri());
  await client.connect();

  store = require('../lib/data/store') as Store;
  mongo = require('../lib/data/mongo') as Mongo;
  deposits = require('../lib/data/deposits') as Deposits;
  accounts = require('../lib/data/accounts') as Accounts;
  categories = require('../lib/data/categories') as Categories;
  calculations = require('../lib/finance/calculations') as Calculations;
});

after(async () => {
  await mongo.closeConnection();
  await client.close();
  await memory.stop();
});

async function resetDatabase() {
  const db = client.db('deposits-test');
  await db.collection('finance').deleteMany({});
  await db.collection('backups').deleteMany({});
}

const EMERGENCY = {
  accountId: 'bank',
  amount: 20_000,
  categoryId: 'savings',
  date: '2026-09-01',
  note: 'Emergency fund',
};

async function balanceOf(accountId: string): Promise<number> {
  const data = await store.readData();
  return calculations
    .getAccountBalances(data)
    .find((b) => b.account.id === accountId)!.currentBalance;
}

describe('adding money to an account', () => {
  beforeEach(resetDatabase);

  it('records it and raises that balance', async () => {
    const created = await deposits.createDeposit(EMERGENCY);

    assert.match(created.id, /^dep_/);
    assert.equal(created.amount, 20_000);
    assert.equal(await balanceOf('bank'), 20_000);
  });

  it('refuses an account that does not exist', async () => {
    await assert.rejects(
      () => deposits.createDeposit({ ...EMERGENCY, accountId: 'nowhere' }),
      (error: unknown) => {
        const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
        assert.match(fieldErrors.accountId ?? '', /account/i);
        return true;
      },
    );
  });

  it('edits one without moving its id', async () => {
    const created = await deposits.createDeposit(EMERGENCY);
    const updated = await deposits.updateDeposit(created.id, { ...EMERGENCY, amount: 25_000 });

    assert.equal(updated.id, created.id);
    assert.equal(updated.createdAt, created.createdAt);
    assert.equal(await balanceOf('bank'), 25_000);
  });

  it('accepts money with no category, since what it is for is optional', async () => {
    const created = await deposits.createDeposit({ ...EMERGENCY, categoryId: '' });

    assert.equal(created.categoryId, null);
    assert.equal(await balanceOf('bank'), 20_000);
    assert.equal((await store.readData()).deposits.length, 1, 'and it survives being read back');
  });

  it('keeps the money when its category is deleted, only forgetting what it was for', async () => {
    await deposits.createDeposit(EMERGENCY);

    await categories.deleteCategory('savings');
    const data = await store.readData();

    assert.equal(data.deposits.length, 1);
    assert.equal(data.deposits[0].categoryId, null);
    assert.equal(await balanceOf('bank'), 20_000);
  });

  it('takes the money back out when deleted', async () => {
    const created = await deposits.createDeposit(EMERGENCY);
    await deposits.deleteDeposit(created.id);

    assert.equal(await balanceOf('bank'), 0);
    assert.equal((await store.readData()).deposits.length, 0);
  });
});

describe('deleting an account holding money', () => {
  beforeEach(resetDatabase);

  it('will not delete it without being told what to do', async () => {
    await deposits.createDeposit(EMERGENCY);

    await assert.rejects(() => accounts.deleteAccount('bank'), /entr/i);

    assert.equal((await store.readData()).deposits.length, 1, 'and nothing is lost');
  });

  it('removes the deposits with it, since money cannot sit in a deleted account', async () => {
    await deposits.createDeposit(EMERGENCY);

    await accounts.deleteAccount('bank', 'unassign');
    const data = await store.readData();

    assert.equal(data.accounts.some((a) => a.id === 'bank'), false);
    assert.equal(data.deposits.length, 0);
  });
});
