import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCloudConfig } from '../src/cloud-config.js';

test('cloud config accepts public keys and refuses secret/admin keys and arbitrary hosts', () => {
  const url = 'https://test.supabase.co';
  assert.equal(validateCloudConfig({ url: '', publishableKey: '' }), null);
  assert.equal(validateCloudConfig({ url, publishableKey: 'sb_publishable_test' }).url, url);
  const jwt = role => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.sig`;
  assert.ok(validateCloudConfig({ url, publishableKey: jwt('anon') }));
  for (const publishableKey of ['sb_secret_test', jwt('service_role'), '', 'invalid']) assert.throws(() => validateCloudConfig({ url, publishableKey }));
  for (const address of ['http://test.supabase.co', 'https://example.com', 'https://test.supabase.co.evil.test']) assert.throws(() => validateCloudConfig({ url: address, publishableKey: 'sb_publishable_test' }));
});
