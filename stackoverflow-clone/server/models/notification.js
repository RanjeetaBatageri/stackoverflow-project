import mongoose from "mongoose";

const notificationSchema = mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  senderName: { type: String, required: true },
  type: {
    type: String,
    enum: ["like", "comment", "mention", "follow"],
    required: true,
  },
  post: { type: mongoose.Schema.Types.ObjectId, ref: "post" },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("notification", notificationSchema);
