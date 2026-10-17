const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateIp, validateUrl } = require('../src/urlSafety');

test('validator URL policy rejects internal targets', () => {
  for (const url of ['http://localhost', 'http://127.0.0.1', 'http://10.0.0.1', 'file:///etc/passwd']) {
    assert.throws(() => validateUrl(url));
  }
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('1.1.1.1'), false);
});

test('validator URL policy accepts standard public HTTP URLs', () => {
  assert.equal(validateUrl('https://example.com/status').toString(), 'https://example.com/status');
  assert.throws(() => validateUrl('https://example.com:8443'));
});
