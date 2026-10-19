import mongoose from "mongoose";

const sessionSchema = mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  deviceFingerprint: { type: String, required: true },
  browser: { type: String, default: "Unknown Browser" },
  os: { type: String, default: "Unknown OS" },
  deviceType: { type: String, default: "desktop" },
  ipAddress: { type: String, default: "127.0.0.1" },
  location: { type: String, default: "Unknown Location" },
  isTrusted: { type: Boolean, default: false },
  isRevoked: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

sessionSchema.index({ user: 1, isRevoked: 1 });
sessionSchema.index({ user: 1, deviceFingerprint: 1 });

export default mongoose.model("session", sessionSchema);

