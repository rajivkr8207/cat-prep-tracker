import mongoose from "mongoose";
import Config from "./Config";

let cached = globalThis.mongoose;
if (!cached) {
  cached = { conn: null, promise: null };
  globalThis.mongoose = cached;
}

export async function connectDB() {
  if (!Config.MONGO_URI) {
    throw new Error("MONGODB_URI (or MONGO_URI) is missing");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(Config.MONGO_URI);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}