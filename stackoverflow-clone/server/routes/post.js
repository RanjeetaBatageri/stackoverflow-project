import express from "express";
import auth, { adminOnly, requireReputation } from "../middleware/auth.js";

import {
  getFeed,
  getTrendingHashtags,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleBookmark,
  sharePost,
  addComment,
  addReply,
  reportPost,
  toggleFollowUser,
  getReportedPosts,
  adminRemovePost,
  adminSuspendUser,
  getNotifications,
  markNotificationsRead,
} from "../controller/post.js";

const router = express.Router();

// Public / Feed routes (optional auth middleware via token header if present)
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return auth(req, res, next);
  }
  next();
};

router.get("/feed", optionalAuth, getFeed);
router.get("/trending-hashtags", getTrendingHashtags);

// Post management
router.post("/create", auth, createPost);
router.put("/update/:id", auth, updatePost);
router.delete("/delete/:id", auth, deletePost);

// Interactions
router.patch("/like/:id", auth, toggleLike);
router.patch("/bookmark/:id", auth, toggleBookmark);
router.post("/share/:id", sharePost);
router.post("/comment/:id", auth, requireReputation(50), addComment);
router.post("/comment/:id/reply/:commentId", auth, requireReputation(50), addReply);
router.post("/report/:id", auth, requireReputation(500), reportPost);


// Social
router.patch("/user/follow/:targetUserId", auth, toggleFollowUser);

// Notifications
router.get("/notifications", auth, getNotifications);
router.patch("/notifications/read", auth, markNotificationsRead);

// Admin Moderation
router.get("/admin/reported", auth, adminOnly, getReportedPosts);
router.patch("/admin/remove/:id", auth, adminOnly, adminRemovePost);
router.patch("/admin/suspend/:userId", auth, adminOnly, adminSuspendUser);

export default router;
