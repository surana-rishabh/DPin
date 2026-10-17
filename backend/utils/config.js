const required = (env, names) => names.filter((name) => !env[name]);

export function assertApiConfig(env) {
  if (env.NODE_ENV !== 'production') return;
  const missing = required(env, ['MONGODB_URI', 'CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'JWT_SECRET', 'FRONTEND_ORIGINS']);
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
  if (env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters in production');
  const origins = env.FRONTEND_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('FRONTEND_ORIGINS must contain only HTTPS origins in production');
  }
  if (env.ENABLE_PAYOUTS === 'true') {
    throw new Error('Production payouts require a KMS/HSM signer and cannot use ADMIN_PRIVATE_KEY');
  }
}

export function assertHubConfig(env) {
  if (env.NODE_ENV === 'production' && !env.MONGODB_URI) throw new Error('MONGODB_URI is required in production');
  for (const name of ['MONITOR_INTERVAL_MS', 'VALIDATION_TIMEOUT_MS', 'VALIDATORS_PER_CHECK', 'COST_PER_VALIDATION']) {
    if (env[name] !== undefined && (!Number.isFinite(Number(env[name])) || Number(env[name]) <= 0)) {
      throw new Error(`${name} must be a positive number`);
    }
  }
}
