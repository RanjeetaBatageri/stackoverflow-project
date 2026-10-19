import mongoose from "mongoose";

const securityLogSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  email: { type: String },
  event: {
    type: String,
    enum: [
      "login_success",
      "login_failed",
      "new_device_detected",
      "new_device_verified",
      "otp_requested",
      "otp_verified",
      "session_revoked",
      "revoke_other_sessions",
      "suspicious_login_attempt",
    ],
    required: true,
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  details: { type: String },
  createdAt: { type: Date, default: Date.now },
});

securityLogSchema.index({ user: 1, createdAt: -1 });
securityLogSchema.index({ event: 1, createdAt: -1 });

export default mongoose.model("securityLog", securityLogSchema);
