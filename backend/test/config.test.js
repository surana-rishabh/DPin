import test from 'node:test';
import assert from 'node:assert/strict';
import { assertApiConfig, assertHubConfig } from '../utils/config.js';

const production = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://database/dpin',
  CLERK_PUBLISHABLE_KEY: 'pk_live_example',
  CLERK_SECRET_KEY: 'sk_live_example',
  JWT_SECRET: 'a'.repeat(32),
  FRONTEND_ORIGINS: 'https://dpin.example',
  ENABLE_PAYOUTS: 'false',
};

test('accepts a fail-closed production API configuration', () => {
  assert.doesNotThrow(() => assertApiConfig(production));
});

test('rejects insecure production origins and raw-key payouts', () => {
  assert.throws(() => assertApiConfig({ ...production, FRONTEND_ORIGINS: 'http://dpin.example' }), /HTTPS/);
  assert.throws(() => assertApiConfig({ ...production, ENABLE_PAYOUTS: 'true' }), /KMS\/HSM/);
});

test('rejects invalid hub limits', () => {
  assert.throws(() => assertHubConfig({ MONITOR_INTERVAL_MS: '0' }), /positive number/);
});
