import mongoose from "mongoose";

const subscriptionSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    plan: { type: String, required: true },
    razorpaySubscriptionId: { type: String, unique: true, sparse: true },
    razorpayPlanId: { type: String },
    status: {
      type: String,
      enum: ["created", "active", "cancelled", "completed", "halted", "pending", "expired"],
      default: "created",
    },
    startDate: { type: Date },
    renewalDate: { type: Date },
    endDate: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);
