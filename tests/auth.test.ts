import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  createSessionToken,
  getAuthMode,
  SESSION_MAX_AGE,
  timingSafeEqual,
  verifySessionToken,
} from '../lib/auth/session';

const ORIGINAL = {
  password: process.env.FINANCE_PASSWORD,
  allow: process.env.FINANCE_ALLOW_NO_PASSWORD,
  nodeEnv: process.env.NODE_ENV,
  secret: process.env.FINANCE_SESSION_SECRET,
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  setEnv({
    FINANCE_PASSWORD: ORIGINAL.password,
    FINANCE_ALLOW_NO_PASSWORD: ORIGINAL.allow,
    NODE_ENV: ORIGINAL.nodeEnv,
    FINANCE_SESSION_SECRET: ORIGINAL.secret,
  });
});

describe('auth mode', () => {
  it('turns the gate on whenever a password is set', () => {
    setEnv({ FINANCE_PASSWORD: 'hunter2', NODE_ENV: 'development' });
    assert.deepEqual(getAuthMode(), { kind: 'password', password: 'hunter2' });
  });

  it('stays open locally when no password is set', () => {
    setEnv({ FINANCE_PASSWORD: undefined, NODE_ENV: 'development' });
    assert.equal(getAuthMode().kind, 'open');
  });

  it('refuses to serve a production build with no password', () => {
    setEnv({ FINANCE_PASSWORD: undefined, FINANCE_ALLOW_NO_PASSWORD: undefined, NODE_ENV: 'production' });
    assert.equal(
      getAuthMode().kind,
      'locked-out',
      'a deployment without a password must fail closed, never serve the data',
    );
  });

  it('allows an explicit opt-out for running a production build locally', () => {
    setEnv({ FINANCE_PASSWORD: undefined, FINANCE_ALLOW_NO_PASSWORD: 'true', NODE_ENV: 'production' });
    assert.equal(getAuthMode().kind, 'open');
  });

  it('treats a blank or whitespace password as no password', () => {
    setEnv({ FINANCE_PASSWORD: '   ', NODE_ENV: 'production', FINANCE_ALLOW_NO_PASSWORD: undefined });
    assert.equal(getAuthMode().kind, 'locked-out');
  });
});

describe('session tokens', () => {
  it('accepts a token it just issued', async () => {
    const token = await createSessionToken('hunter2');
    assert.equal(await verifySessionToken(token, 'hunter2'), true);
  });

  it('rejects a token signed with a different password', async () => {
    const token = await createSessionToken('hunter2');
    assert.equal(
      await verifySessionToken(token, 'different'),
      false,
      'changing the password must sign every device out',
    );
  });

  it('rejects a tampered signature', async () => {
    const token = await createSessionToken('hunter2');
    const [payload, signature] = token.split('.');
    const flipped = signature[0] === 'A' ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
    assert.equal(await verifySessionToken(`${payload}.${flipped}`, 'hunter2'), false);
  });

  it('rejects an extended expiry that was not re-signed', async () => {
    const token = await createSessionToken('hunter2');
    const signature = token.slice(token.lastIndexOf('.') + 1);
    const forged = `${Date.now() + 10 * 365 * 24 * 3600 * 1000}.${signature}`;
    assert.equal(await verifySessionToken(forged, 'hunter2'), false);
  });

  it('rejects an expired token', async () => {
    const issuedLongAgo = Date.now() - (SESSION_MAX_AGE + 60) * 1000;
    const token = await createSessionToken('hunter2', issuedLongAgo);
    assert.equal(await verifySessionToken(token, 'hunter2'), false);
  });

  it('rejects missing and malformed tokens', async () => {
    for (const token of [undefined, '', 'nonsense', '.', 'abc.def', '123']) {
      assert.equal(await verifySessionToken(token, 'hunter2'), false, `should reject ${JSON.stringify(token)}`);
    }
  });
});

describe('timing-safe comparison', () => {
  it('matches equal strings and rejects everything else', () => {
    assert.equal(timingSafeEqual('hunter2', 'hunter2'), true);
    assert.equal(timingSafeEqual('hunter2', 'hunter3'), false);
    assert.equal(timingSafeEqual('hunter2', 'hunter'), false);
    assert.equal(timingSafeEqual('', ''), true);
  });
});
