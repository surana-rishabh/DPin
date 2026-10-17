import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { WebSocket, WebSocketServer } from 'ws';
import { connectDatabase } from '../db/db.js';
import { DownLog, User, Validator, Website, WebsiteTick } from '../model/model.js';
import { normalizeMonitorUrl } from '../utils/urlSafety.js';
import { validateResult, validationMessage } from '../utils/validationResult.js';
import { assertHubConfig } from '../utils/config.js';

assertHubConfig(process.env);
await connectDatabase();

const port = Number(process.env.HUB_PORT || 8081);
const intervalMs = Number(process.env.MONITOR_INTERVAL_MS || 30_000);
const validationTimeoutMs = Number(process.env.VALIDATION_TIMEOUT_MS || 10_000);
const validatorLimit = Number(process.env.VALIDATORS_PER_CHECK || 3);
const costPerValidation = Number(process.env.COST_PER_VALIDATION || 100);
const callbacks = new Map();
const validators = new Map();
let pollRunning = false;
let rotation = 0;

const mailer = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
  : null;

const signupMessage = (challenge, publicKey) => `dpin:signup:${challenge}:${publicKey}`;

function verifyMessage(message, publicKey, signature) {
  try {
    const publicKeyBytes = naclUtil.decodeBase64(publicKey);
    const signatureBytes = Uint8Array.from(JSON.parse(signature));
    return publicKeyBytes.length === nacl.sign.publicKeyLength &&
      signatureBytes.length === nacl.sign.signatureLength &&
      nacl.sign.detached.verify(naclUtil.decodeUTF8(message), signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

async function registerValidator(ws, data) {
  if (ws.authenticated || data.challenge !== ws.challenge) throw new Error('Invalid signup challenge');
  if (!verifyMessage(signupMessage(ws.challenge, data.publicKey), data.publicKey, data.signedMessage)) {
    throw new Error('Invalid validator signature');
  }

  const validator = await Validator.findOne({ publicKey: data.publicKey });
  if (!validator) throw new Error('Validator public key is not registered');

  const key = String(validator._id);
  const previous = validators.get(key);
  if (previous && previous.socket !== ws) previous.socket.close(4001, 'Replaced by a newer authenticated session');

  ws.authenticated = true;
  ws.validatorKey = key;
  ws.challenge = null;
  validators.set(key, {
    validatorId: validator._id,
    publicKey: validator.publicKey,
    location: validator.location,
    socket: ws,
  });
  send(ws, {
    type: 'signup',
    data: {
      validatorId: validator._id,
      location: validator.location,
      pendingPayouts: validator.pendingPayouts,
      callbackId: data.callbackId,
    },
  });
}

async function notifyOwner(website, location) {
  if (!mailer) return;
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const claimed = await Website.findOneAndUpdate(
    { _id: website._id, $or: [{ lastEmailSent: { $lt: cutoff } }, { lastEmailSent: { $exists: false } }, { lastEmailSent: null }] },
    { $set: { lastEmailSent: new Date() } },
    { new: true }
  );
  if (!claimed) return;

  const owner = await User.findOne({ userId: website.userId }).select('email').lean();
  if (!owner?.email) return;
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: owner.email,
    subject: `dPIN detected an outage for ${website.websiteName}`,
    text: `${website.websiteName} (${website.url}) returned a failed check from ${location}. Confirm the incident before taking action.`,
  });
}

async function acceptValidation(ws, message) {
  const callbackId = String(message?.data?.callbackId || '');
  const job = callbacks.get(callbackId);
  if (!job || job.socket !== ws) throw new Error('Unknown or expired validation callback');
  callbacks.delete(callbackId);
  clearTimeout(job.timeout);

  const result = validateResult(message.data, job.validator.validatorId, job.validator.location);
  if (!verifyMessage(validationMessage(result), job.validator.publicKey, result.signedMessage)) {
    throw new Error('Invalid validation result signature');
  }

  if (result.status === 'Bad') {
    const duplicate = await DownLog.exists({
      websiteId: job.website._id,
      location: result.location,
      createdAt: { $gte: new Date(Date.now() - 5 * 60_000) },
    });
    if (!duplicate) await DownLog.create({ websiteId: job.website._id, location: result.location });
    notifyOwner(job.website, result.location).catch((error) => console.error('Outage email failed', error));
  }

  await Promise.all([
    WebsiteTick.create({
      websiteId: job.website._id,
      validatorId: job.validator.validatorId,
      status: result.status,
      latency: result.latency,
    }),
    Validator.findByIdAndUpdate(job.validator.validatorId, { $inc: { pendingPayouts: costPerValidation } }),
  ]);
}

const wss = new WebSocketServer({ port, maxPayload: 16 * 1024, perMessageDeflate: false });

wss.on('connection', (ws) => {
  ws.challenge = randomUUID();
  ws.authenticated = false;
  send(ws, { type: 'challenge', data: { challenge: ws.challenge, protocolVersion: 2 } });

  ws.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'signup') await registerValidator(ws, message.data || {});
      else if (message.type === 'validate' && ws.authenticated) await acceptValidation(ws, message);
      else throw new Error('Unsupported or unauthenticated message');
    } catch (error) {
      send(ws, { type: 'error', data: { message: error.message } });
      if (!ws.authenticated) ws.close(4003, 'Validator authentication failed');
    }
  });

  ws.on('close', () => {
    if (!ws.validatorKey) return;
    const current = validators.get(ws.validatorKey);
    if (current?.socket === ws) validators.delete(ws.validatorKey);
  });
});

function chooseValidators() {
  const connected = Array.from(validators.values()).filter(({ socket }) => socket.readyState === WebSocket.OPEN);
  if (connected.length <= validatorLimit) return connected;
  const chosen = [];
  for (let index = 0; index < validatorLimit; index += 1) chosen.push(connected[(rotation + index) % connected.length]);
  rotation = (rotation + validatorLimit) % connected.length;
  return chosen;
}

async function dispatchChecks() {
  if (pollRunning || validators.size === 0) return;
  pollRunning = true;
  try {
    const websites = await Website.find({ disabled: false }).lean();
    for (const website of websites) {
      let url;
      try {
        url = normalizeMonitorUrl(website.url);
      } catch (error) {
        console.error(`Skipping unsafe monitor ${website._id}: ${error.message}`);
        continue;
      }

      for (const validator of chooseValidators()) {
        const callbackId = randomUUID();
        const timeout = setTimeout(() => callbacks.delete(callbackId), validationTimeoutMs);
        callbacks.set(callbackId, { website, validator, socket: validator.socket, timeout });
        send(validator.socket, { type: 'validate', data: { url, callbackId } });
      }
    }
  } finally {
    pollRunning = false;
  }
}

const pollTimer = setInterval(() => dispatchChecks().catch((error) => console.error('Monitor dispatch failed', error)), intervalMs);
pollTimer.unref();
console.log(`Validator hub listening on port ${port}`);

const shutdown = () => {
  clearInterval(pollTimer);
  for (const job of callbacks.values()) clearTimeout(job.timeout);
  wss.close(() => mongoose.connection.close().finally(() => process.exit(0)));
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
