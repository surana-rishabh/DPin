import mongoose from "mongoose";

const websiteStatusEnum = ["Good", "Bad"];

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  userId: { type: String, required: true, unique: true },
}, { timestamps: true });

const websiteSchema = new mongoose.Schema({
  url: { type: String, required: true, maxlength: 2048 },
  websiteName: { type: String, required: true, trim: true, maxlength: 100 },
  userId: { type: String, required: true, ref: "User" },
  createdAt: { type: Date, required: true, default: Date.now },
  disabled: { type: Boolean, default: false },
  lastEmailSent : Date
});

const validatorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  publicKey: { type: String, required: true, unique: true },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  ip: { type: String, required: true },
  pendingPayouts: { type: Number, default: 0, min: 0 },
  payoutPublicKey: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  payoutInProgress: { type: Boolean, default: false },
}, { timestamps: true });

const websiteTickSchema = new mongoose.Schema({
  websiteId: { type: String, required: true, ref: "Website" },
  validatorId: { type: String, required: true, ref: "Validator" },
  createdAt: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: websiteStatusEnum, required: true },
  latency: { type: Number, required: true },
});

const downLogSchema = new mongoose.Schema({
  websiteId: { type: String, required: true, ref: "Website" },
  createdAt: { type: Date, required: true, default: Date.now },
  location: { type: String, required: true },
});

const payoutSchema = new mongoose.Schema({
  validatorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Validator', index: true },
  amount: { type: Number, required: true, min: 1 },
  signature: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['reserved', 'submitted', 'confirmed', 'failed'], required: true },
  error: { type: String, maxlength: 500 },
}, { timestamps: true });

websiteSchema.index({ userId: 1, createdAt: -1 });
websiteTickSchema.index({ websiteId: 1, createdAt: -1 });
websiteTickSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
downLogSchema.index({ websiteId: 1, createdAt: -1 });
downLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const User = mongoose.model("User", userSchema);
const Website = mongoose.model("Website", websiteSchema);
const Validator = mongoose.model("Validator", validatorSchema);
const WebsiteTick = mongoose.model("WebsiteTick", websiteTickSchema);
const DownLog = mongoose.model("DownLog", downLogSchema);
const Payout = mongoose.model('Payout', payoutSchema);

export { User, Website, Validator, WebsiteTick, DownLog, Payout };
