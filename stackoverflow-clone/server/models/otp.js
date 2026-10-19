import mongoose from "mongoose";

const otpSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  targetLanguage: { type: String, required: true },
  type: { type: String, enum: ["email", "mobile"], required: true },
  destination: { type: String, required: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

otpSchema.index({ user: 1, targetLanguage: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("otp", otpSchema);
