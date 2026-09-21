import mongoose from "mongoose";

const userschema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  about: { type: String },
  tags: { type: [String] },
  joinDate: { type: Date, default: Date.now },
  plan: { type: String, enum: ["free", "bronze", "silver", "gold"], default: "free" },
  subscriptionStatus: {
    type: String,
    enum: ["none", "active", "cancelled", "completed", "halted", "pending", "expired"],
    default: "none",
  },
  razorpaySubscriptionId: { type: String },
  razorpayCustomerId: { type: String },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  subscriptionEndDate: { type: Date },
  dailyQuestionCount: { type: Number, default: 0 },
  lastQuestionDate: { type: Date },
});
export default mongoose.model("user", userschema);
