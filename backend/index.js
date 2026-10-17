import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcrypt';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import { clerkMiddleware } from '@clerk/express';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { connectDatabase } from './db/db.js';
import { DownLog, Payout, User, Validator, Website, WebsiteTick } from './model/model.js';
import { authenticateUser, authenticateValidator } from './middleware.js';
import { normalizeMonitorUrl } from './utils/urlSafety.js';
import { assertApiConfig } from './utils/config.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Resource-Policy': 'same-site',
  });
  next();
});
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
app.use(express.json({ limit: '32kb' }));
app.use(clerkMiddleware());

const authAttempts = new Map();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const authCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authAttempts) if (value.resetAt <= now) authAttempts.delete(key);
}, 15 * 60_000);
authCleanup.unref();
const limitAuthAttempts = (req, res, next) => {
  // shortcut: this limiter is process-local, add a shared edge limit before horizontal scaling.
  const now = Date.now();
  const key = req.ip;
  const entry = authAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return next();
  }
  if (entry.count >= 10) return res.status(429).json({ message: 'Too many attempts. Try again later.' });
  entry.count += 1;
  return next();
};

const validEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const validObjectId = (id) => mongoose.isValidObjectId(id);
async function getWebsiteMetrics(website, totalValidators = 0) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [ticks, downlog] = await Promise.all([
    WebsiteTick.find({ websiteId: website._id, createdAt: { $gte: since } }).sort({ createdAt: 1 }).lean(),
    DownLog.find({ websiteId: website._id }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const grouped = new Map();
  let goodTicks = 0;

  for (const tick of ticks) {
    if (tick.status === 'Good') goodTicks += 1;
    const minute = new Date(tick.createdAt).setSeconds(0, 0);
    const bucket = grouped.get(minute) || { total: 0, count: 0, goodCount: 0 };
    bucket.total += tick.latency;
    bucket.count += 1;
    if (tick.status === 'Good') bucket.goodCount += 1;
    grouped.set(minute, bucket);
  }

  const recentTicks = ticks.slice(-50);
  const recentLatency = recentTicks.reduce((total, tick) => total + tick.latency, 0);
  const latestTick = ticks.at(-1);

  return {
    id: website._id,
    websiteName: website.websiteName,
    url: website.url,
    dateCreated: website.createdAt,
    uptimePercentage: ticks.length ? (goodTicks / ticks.length) * 100 : 0,
    response: recentTicks.length ? Number((recentLatency / recentTicks.length).toFixed(2)) : null,
    averageLatencyPerMinute: Array.from(grouped, ([timestamp, bucket]) => ({
      timestamp: new Date(timestamp),
      averageLatency: bucket.total / bucket.count,
      status: bucket.goodCount === bucket.count ? 'up' : 'down',
    })),
    disabled: website.disabled,
    downlog,
    totalTicks: ticks.length,
    goodTicks,
    currentStatus: latestTick?.status || null,
    lastCheckedAt: latestTick?.createdAt || null,
    totalValidator: totalValidators,
  };
}

app.get('/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({ status: databaseReady ? 'ok' : 'degraded', database: databaseReady ? 'connected' : 'unavailable' });
});

app.post('/user', authenticateUser, asyncRoute(async (req, res) => {
  if (!validEmail(req.body.email)) return res.status(400).json({ message: 'A valid email is required' });
  const user = await User.findOneAndUpdate(
    { userId: req.authenticatedUserId },
    { $set: { email: req.body.email.toLowerCase() } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return res.status(200).json(user);
}));

app.post('/validator', limitAuthAttempts, asyncRoute(async (req, res) => {
  try {
    const { name, email, payoutPublicKey, publicKey, location, password } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 100) return res.status(400).json({ message: 'A valid name is required' });
    if (!validEmail(email)) return res.status(400).json({ message: 'A valid email is required' });
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) return res.status(400).json({ message: 'Password must contain 12 to 128 characters' });
    if (typeof location !== 'string' || !location.trim() || location.length > 160) return res.status(400).json({ message: 'A valid location is required' });
    if (typeof publicKey !== 'string' || Buffer.from(publicKey, 'base64').length !== 32) return res.status(400).json({ message: 'Invalid validator public key' });
    let payoutKey;
    try { payoutKey = new PublicKey(payoutPublicKey); } catch { return res.status(400).json({ message: 'Invalid payout public key' }); }
    if (!process.env.RPC_URL) return res.status(503).json({ message: 'Validator balance verification is not configured' });
    const minimumBalance = Number(process.env.MIN_VALIDATOR_BALANCE_LAMPORTS || 50_000_000);
    const payoutBalance = await new Connection(process.env.RPC_URL, 'confirmed').getBalance(payoutKey, 'confirmed');
    if (payoutBalance < minimumBalance) return res.status(400).json({ message: `Payout wallet requires at least ${minimumBalance} lamports` });

    const duplicate = await Validator.findOne({ $or: [
      { email: email.toLowerCase() },
      { publicKey },
      { payoutPublicKey },
    ] }).select('_id').lean();
    if (duplicate) return res.status(409).json({ message: 'Validator identity already registered' });

    const validator = await Validator.create({
      name: name.trim(),
      email: email.toLowerCase(),
      publicKey,
      location: location.trim(),
      ip: req.ip,
      payoutPublicKey,
      password: await bcrypt.hash(password, 12),
    });
    return res.status(201).json({
      id: validator._id,
      name: validator.name,
      email: validator.email,
      publicKey: validator.publicKey,
      payoutPublicKey: validator.payoutPublicKey,
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'Validator identity already registered' });
    console.error('Validator registration failed', error);
    return res.status(500).json({ message: 'Validator registration failed' });
  }
}));

app.post('/validator-signin', limitAuthAttempts, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase();
  const validator = await Validator.findOne({ email }).select('+password');
  if (!validator || !(await bcrypt.compare(String(req.body.password || ''), validator.password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'Validator authentication is not configured' });

  const token = jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(validator._id),
    issuer: 'dpin-api',
    audience: 'dpin-validator',
    expiresIn: '15m',
  });
  res.cookie('validator_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 15 * 60_000,
    path: '/',
  });
  return res.status(200).json({ message: 'Signed in' });
}));

app.post('/validator-signout', (req, res) => {
  res.clearCookie('validator_token', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
  return res.status(204).end();
});

app.get('/validator-detail', authenticateValidator, asyncRoute(async (req, res) => {
  const [recentWebsites, payoutStats] = await Promise.all([
    WebsiteTick.find({ validatorId: req.user._id }).sort({ createdAt: -1 }).limit(5).lean(),
    Validator.aggregate([{ $group: { _id: null, average: { $avg: '$pendingPayouts' }, total: { $sum: 1 } } }]),
  ]);
  const validator = req.user.toObject();
  delete validator.password;
  return res.json({
    validator,
    recentWebsites,
    averagePayout: payoutStats[0]?.average || 0,
    totalValidator: payoutStats[0]?.total || 0,
    payoutsEnabled: process.env.ENABLE_PAYOUTS === 'true' && !isProduction,
  });
}));

app.post('/getPayout', authenticateValidator, asyncRoute(async (req, res) => {
  if (process.env.ENABLE_PAYOUTS !== 'true') return res.status(503).json({ message: 'Payouts are disabled until treasury reconciliation is configured' });
  if (isProduction) return res.status(503).json({ message: 'Production payouts require KMS/HSM-backed signing' });
  if (!process.env.RPC_URL || !process.env.ADMIN_PUBLIC_KEY || !process.env.ADMIN_PRIVATE_KEY) return res.status(503).json({ message: 'Payout service is not configured' });

  let reserved;
  let payout;
  let signature;
  try {
    reserved = await Validator.findOneAndUpdate(
      { _id: req.user._id, payoutInProgress: { $ne: true }, pendingPayouts: { $gt: 0 } },
      { $set: { payoutInProgress: true } },
      { new: true }
    ).select('pendingPayouts payoutPublicKey');
    if (!reserved) return res.status(409).json({ message: 'No payout is available or a payout is already in progress' });

    payout = await Payout.create({ validatorId: reserved._id, amount: reserved.pendingPayouts, status: 'reserved' });
    const connection = new Connection(process.env.RPC_URL, 'confirmed');
    const fromKeypair = await Keypair.fromSecretKey(bs58.decode(process.env.ADMIN_PRIVATE_KEY));
    if (!fromKeypair.publicKey.equals(new PublicKey(process.env.ADMIN_PUBLIC_KEY))) throw new Error('Treasury key configuration does not match');

    const balance = await connection.getBalance(fromKeypair.publicKey, 'confirmed');
    if (balance < reserved.pendingPayouts + 10_000) throw new Error('Treasury balance is too low');

    const transaction = new Transaction().add(SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: new PublicKey(reserved.payoutPublicKey),
      lamports: reserved.pendingPayouts,
    }));
    signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair], { commitment: 'confirmed' });
    await Payout.findByIdAndUpdate(payout._id, { status: 'submitted', signature });

    const finalized = await Validator.findOneAndUpdate(
      { _id: reserved._id, payoutInProgress: true, pendingPayouts: { $gte: reserved.pendingPayouts } },
      { $inc: { pendingPayouts: -reserved.pendingPayouts }, $set: { payoutInProgress: false } },
      { new: true }
    );
    if (!finalized) throw new Error('Payout requires reconciliation');

    await Payout.findByIdAndUpdate(payout._id, { status: 'confirmed' });
    return res.json({ message: 'Payout confirmed', signature, amount: reserved.pendingPayouts });
  } catch (error) {
    console.error('Payout failed', error);
    if (payout) await Payout.findByIdAndUpdate(payout._id, { status: signature ? 'submitted' : 'failed', error: error.message });
    if (reserved && !signature) await Validator.findByIdAndUpdate(reserved._id, { $set: { payoutInProgress: false } });
    return res.status(503).json({ message: signature ? 'Payout submitted and requires reconciliation' : 'Payout failed' });
  }
}));

app.post('/website', authenticateUser, asyncRoute(async (req, res) => {
  try {
    const websiteName = String(req.body.websiteName || '').trim();
    if (!websiteName || websiteName.length > 100) return res.status(400).json({ message: 'A valid monitor name is required' });
    const website = await Website.create({
      url: normalizeMonitorUrl(req.body.url),
      userId: req.authenticatedUserId,
      websiteName,
    });
    return res.status(201).json(website);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}));

app.put('/website-track/:id', authenticateUser, asyncRoute(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid website ID' });
  const current = await Website.findOne({ _id: req.params.id, userId: req.authenticatedUserId }).select('disabled');
  if (!current) return res.status(404).json({ message: 'Website not found' });
  const website = await Website.findOneAndUpdate(
    { _id: current._id, userId: req.authenticatedUserId },
    { $set: { disabled: !current.disabled } },
    { new: true }
  );
  return res.json({ website, message: 'Updated successfully' });
}));

app.get('/website-details/:id', authenticateUser, asyncRoute(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid website ID' });
  const website = await Website.findOne({ _id: req.params.id, userId: req.authenticatedUserId }).lean();
  if (!website) return res.status(404).json({ message: 'Website not found' });
  const totalValidators = await Validator.countDocuments();
  return res.json(await getWebsiteMetrics(website, totalValidators));
}));

app.delete('/website/:id', authenticateUser, asyncRoute(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid website ID' });
  const website = await Website.findOneAndDelete({ _id: req.params.id, userId: req.authenticatedUserId });
  if (!website) return res.status(404).json({ message: 'Website not found' });
  await Promise.all([
    WebsiteTick.deleteMany({ websiteId: website._id }),
    DownLog.deleteMany({ websiteId: website._id }),
  ]);
  return res.json({ message: 'Website deleted successfully' });
}));

app.get('/dashboard-details', authenticateUser, asyncRoute(async (req, res) => {
  const websites = await Website.find({ userId: req.authenticatedUserId }).sort({ createdAt: -1 }).lean();
  const details = await Promise.all(websites.map((website) => getWebsiteMetrics(website)));
  const disabledCount = websites.filter((website) => website.disabled).length;
  return res.json({
    websiteCount: websites.length,
    websites: details,
    disabledCount,
    enabledCount: websites.length - disabledCount,
  });
}));

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(error.message === 'Origin is not allowed' ? 403 : 500).json({ message: 'Request failed' });
});

export async function startServer() {
  assertApiConfig(process.env);
  await connectDatabase();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => console.log(`API listening on port ${port}`));
  const shutdown = () => {
    clearInterval(authCleanup);
    server.close(() => mongoose.connection.close().finally(() => process.exit(0)));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

export { app };
