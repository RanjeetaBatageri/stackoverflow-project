import mongoose from "mongoose";

const reputationLogSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  amount: { type: Number, required: true },
  reason: {
    type: String,
    enum: [
      "post_answer",
      "accepted_answer",
      "answer_upvote_threshold",
      "question_upvote_threshold",
      "profile_bonus",
      "downvote_deduction",
      "delete_own_answer_deduction",
      "admin_removal_deduction",
      "transfer_sent",
      "transfer_received",
    ],
    required: true,
  },
  details: { type: String },
  relatedId: { type: String },
  resultingBalance: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

reputationLogSchema.index({ user: 1, createdAt: -1 });
reputationLogSchema.index({ user: 1, reason: 1, relatedId: 1 });

export default mongoose.model("reputationLog", reputationLogSchema);
