import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  sessionSecret
} from '../src/lib/auth/session.mjs';
process.env.ADMIN_SESSION_SECRET = 'test-only-secret-0000000000000000000000000000';
process.env.ADMIN_EMAILS = 'admin@example.test';
process.env.ARBITER_EMAILS = 'arbiter@example.test';
test('signed sessions expire in eight hours and preserve roles', async () => {
  const token = await createAdminSessionToken('ADMIN@example.test'),
    data = await verifyAdminSessionToken(token);
  assert.equal(data.email, 'admin@example.test');
  assert.equal(data.role, 'admin');
  assert.equal(ADMIN_SESSION_MAX_AGE_SECONDS, 28800);
  assert(Math.abs(data.exp - Date.now() / 1000 - 28800) < 2);
  assert.equal((await verifyAdminSessionToken(await createAdminSessionToken('arbiter@example.test')))
    .role, 'arbiter');
});
test('tampered, malformed and revoked sessions rejected', async () => {
  const token = await createAdminSessionToken('admin@example.test');
  assert.equal(await verifyAdminSessionToken('bad'), null);
  assert.equal(await verifyAdminSessionToken(token + 'x'), null);
  const [payload, signature] = token.split('.'), data = JSON.parse(Buffer.from(payload, 'base64url'));
  data.role = 'arbiter';
  assert.equal(await verifyAdminSessionToken(Buffer.from(JSON.stringify(data)).toString('base64url') +
    '.' + signature), null);
  process.env.ADMIN_EMAILS = '';
  assert.equal(await verifyAdminSessionToken(token), null);
  process.env.ADMIN_EMAILS = 'admin@example.test';
});
test('missing session secret fails closed without a default', async () => {
  const original = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  assert.throws(() => sessionSecret(), /32 characters/);
  assert.equal(await verifyAdminSessionToken('a.b'), null);
  process.env.ADMIN_SESSION_SECRET = original;
});
