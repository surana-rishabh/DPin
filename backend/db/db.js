import 'dotenv/config';
import mongoose from "mongoose";

const db = mongoose.connection;

export async function connectDatabase() {
  if (db.readyState === 1) return db;
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/dpin";
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
  });
  console.log("Database connection established");
  return db;
}

export default db;
