import mongoose from "mongoose";

const invoiceSchema = mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    plan: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    billingDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["paid", "pending", "refunded"],
      default: "paid",
    },
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },
    confirmationEmailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Invoice", invoiceSchema);
