import mongoose from "mongoose";

const paymentSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    plan: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
    },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpayOrderId: { type: String },
    razorpaySubscriptionId: { type: String },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
