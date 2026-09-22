import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

/**
 * Money moved between accounts, against a real MongoDB.
 *
 * As in `store.test.ts`, the modules are `require`d inside the hooks so that
 * `MONGODB_URI` is set before the connection module is first loaded.
 */

type Store = typeof import('../lib/data/store');
type Mongo = typeof import('../lib/data/mongo');
type Transfers = typeof import('../lib/data/transfers');
type Accounts = typeof import('../lib/data/accounts');
type Calculations = typeof import('../lib/finance/calculations');

let memory: MongoMemoryServer;
let client: MongoClient;
let store: Store;
let mongo: Mongo;
let transfers: Transfers;
let accounts: Accounts;
let calculations: Calculations;

before(async () => {
  memory = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memory.getUri();
  process.env.MONGODB_DB = 'transfers-test';

  client = new MongoClient(memory.getUri());
  await client.connect();

  store = require('../lib/data/store') as Store;
  mongo = require('../lib/data/mongo') as Mongo;
  transfers = require('../lib/data/transfers') as Transfers;
  accounts = require('../lib/data/accounts') as Accounts;
  calculations = require('../lib/finance/calculations') as Calculations;
});

after(async () => {
  await mongo.closeConnection();
  await client.close();
  await memory.stop();
});

async function resetDatabase() {
  const db = client.db('transfers-test');
  await db.collection('finance').deleteMany({});
  await db.collection('backups').deleteMany({});
}

const MOVE = {
  fromAccountId: 'bank',
  toAccountId: 'cash',
  amount: 5_000,
  categoryId: 'savings',
  date: '2026-09-22',
  note: '',
};

async function balanceOf(accountId: string): Promise<number> {
  const data = await store.readData();
  return calculations
    .getAccountBalances(data)
    .find((b) => b.account.id === accountId)!.currentBalance;
}

describe('moving money between accounts', () => {
  beforeEach(resetDatabase);

  it('records it and moves the balance', async () => {
    const created = await transfers.createTransfer(MOVE);

    assert.match(created.id, /^tr_/);
    assert.equal(await balanceOf('bank'), -5_000);
    assert.equal(await balanceOf('cash'), 5_000);
  });

  it('refuses the same account on both sides', async () => {
    await assert.rejects(
      () => transfers.createTransfer({ ...MOVE, toAccountId: 'bank' }),
      (error: unknown) => {
        const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
        assert.match(fieldErrors.toAccountId ?? '', /different/i);
        return true;
      },
    );
  });

  it('edits one without moving its id', async () => {
    const created = await transfers.createTransfer(MOVE);
    const updated = await transfers.updateTransfer(created.id, { ...MOVE, amount: 7_000 });

    assert.equal(updated.id, created.id);
    assert.equal(updated.createdAt, created.createdAt);
    assert.equal(await balanceOf('cash'), 7_000);
  });

  it('puts the money back when deleted', async () => {
    const created = await transfers.createTransfer(MOVE);
    await transfers.deleteTransfer(created.id);

    assert.equal(await balanceOf('bank'), 0);
    assert.equal((await store.readData()).transfers.length, 0);
  });
});

describe('deleting an account that has transfers', () => {
  beforeEach(resetDatabase);

  it('counts them as usage and removes them on unassign', async () => {
    await transfers.createTransfer(MOVE);

    await assert.rejects(() => accounts.deleteAccount('cash'), /entr/i);

    await accounts.deleteAccount('cash', 'unassign');
    assert.equal((await store.readData()).transfers.length, 0);
    assert.equal(await balanceOf('bank'), 0);
  });
});
