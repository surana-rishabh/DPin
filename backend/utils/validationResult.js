const statuses = new Set(['Good', 'Bad']);

export function validationMessage({ callbackId, validatorId, status, latency, location }) {
  return JSON.stringify([callbackId, String(validatorId), status, latency, location]);
}

export function validateResult(data, expectedValidatorId, expectedLocation) {
  if (!data || typeof data !== 'object') throw new Error('Validation result is missing');

  const validatorId = String(data.validatorId || '');
  const latency = Number(data.latency);
  const location = String(data.location || '').trim();

  if (validatorId !== String(expectedValidatorId)) throw new Error('Validator identity mismatch');
  if (expectedLocation && location !== expectedLocation) throw new Error('Validator location mismatch');
  if (!statuses.has(data.status)) throw new Error('Invalid validation status');
  if (!Number.isFinite(latency) || latency < 0 || latency > 60_000) throw new Error('Invalid validation latency');
  if (!location || location.length > 160) throw new Error('Invalid validator location');

  return {
    callbackId: String(data.callbackId || ''),
    validatorId,
    status: data.status,
    latency: Math.round(latency),
    location,
    signedMessage: data.signedMessage,
  };
}
