import mongoose from "mongoose";

const commentSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  userName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  replies: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
      userName: { type: String, required: true },
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

const postSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    userName: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    codeSnippet: { type: String },
    mediaUrl: { type: String },
    category: {
      type: String,
      enum: ["technical_update", "code_snippet", "project_showcase", "achievement"],
      default: "technical_update",
    },
    hashtags: { type: [String], default: [] },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    sharesCount: { type: Number, default: 0 },
    comments: [commentSchema],
    engagementScore: { type: Number, default: 0 },
    reports: [
      {
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        reason: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isRemoved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ engagementScore: -1 });
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });

export default mongoose.model("post", postSchema);
