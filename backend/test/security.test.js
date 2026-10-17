import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, normalizeMonitorUrl } from '../utils/urlSafety.js';
import { validateResult, validationMessage } from '../utils/validationResult.js';

test('normalizes public monitor URLs', () => {
  assert.equal(normalizeMonitorUrl(' https://example.com/status#fragment '), 'https://example.com/status');
});

test('rejects local and private monitor targets', () => {
  for (const url of ['http://localhost', 'http://127.0.0.1', 'http://10.0.0.1', 'http://[::1]', 'file:///etc/passwd']) {
    assert.throws(() => normalizeMonitorUrl(url));
  }
  assert.equal(isPrivateIp('192.168.1.3'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
});

test('binds every accepted result field to a deterministic signed message', () => {
  const result = validateResult({
    callbackId: 'callback',
    validatorId: 'validator',
    status: 'Good',
    latency: 42.2,
    location: 'Mumbai, IN',
    signedMessage: 'signature',
  }, 'validator', 'Mumbai, IN');

  assert.equal(
    validationMessage(result),
    '["callback","validator","Good",42,"Mumbai, IN"]'
  );
  assert.throws(() => validateResult({ ...result, validatorId: 'attacker' }, 'validator'));
  assert.throws(() => validateResult({ ...result, location: 'Elsewhere' }, 'validator', 'Mumbai, IN'));
});
