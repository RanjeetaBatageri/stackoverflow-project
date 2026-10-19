import Post from "../models/post.js";
import User from "../models/auth.js";
import Notification from "../models/notification.js";
import { adjustReputation } from "../services/reputation.js";


// Helper to calculate engagement score
const updateEngagementScore = async (postId) => {
  const post = await Post.findById(postId);
  if (!post) return;
  const likesCount = post.likes.length;
  const commentsCount = post.comments.length;
  const sharesCount = post.sharesCount || 0;
  post.engagementScore = likesCount * 2 + commentsCount * 3 + sharesCount * 5;
  await post.save();
};

// Helper for notifications
const createNotification = async ({ recipient, sender, senderName, type, post }) => {
  if (String(recipient) === String(sender)) return;
  await Notification.create({ recipient, sender, senderName, type, post });
};

// GET /post/feed?feedType=personalized|all|trending&page=1&limit=10&hashtag=xxx
export const getFeed = async (req, res) => {
  const { feedType = "all", page = 1, limit = 10, hashtag } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  try {
    const query = { isRemoved: { $ne: true } };

    if (hashtag) {
      query.hashtags = hashtag.toLowerCase();
    }

    if (feedType === "personalized" && req.userid) {
      const currentUser = await User.findById(req.userid);
      const followingIds = currentUser?.following || [];
      query.user = { $in: [...followingIds, req.userid] };
    }

    let sort = { createdAt: -1 };
    if (feedType === "trending") {
      sort = { engagementScore: -1, createdAt: -1 };
    }

    const posts = await Post.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate("user", "name email role")
      .populate("comments.user", "name");

    const total = await Post.countDocuments(query);

    res.status(200).json({
      posts,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalPosts: total,
    });
  } catch (error) {
    console.error("Get feed error:", error);
    res.status(500).json({ message: "Failed to fetch community feed" });
  }
};

// GET /post/trending-hashtags
export const getTrendingHashtags = async (req, res) => {
  try {
    const result = await Post.aggregate([
      { $match: { isRemoved: { $ne: true } } },
      { $unwind: "$hashtags" },
      { $group: { _id: "$hashtags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json(result.map((r) => ({ tag: r._id, count: r.count })));
  } catch (error) {
    console.error("Trending hashtags error:", error);
    res.status(500).json({ message: "Failed to fetch trending hashtags" });
  }
};

// POST /post/create
export const createPost = async (req, res) => {
  const { title, content, codeSnippet, mediaUrl, category, hashtags } = req.body;
  const userId = req.userid;

  if (!title || !content) {
    return res.status(400).json({ message: "Title and content are required" });
  }

  // File/Media URL validation if supplied
  if (mediaUrl && !mediaUrl.startsWith("http://") && !mediaUrl.startsWith("https://") && !mediaUrl.startsWith("data:image/")) {
    return res.status(400).json({ message: "Invalid media URL format" });
  }

  try {
    const parsedHashtags = Array.isArray(hashtags)
      ? hashtags.map((h) => h.replace(/^#/, "").toLowerCase().trim()).filter(Boolean)
      : (content.match(/#\w+/g) || []).map((h) => h.replace(/^#/, "").toLowerCase().trim());

    const newPost = await Post.create({
      user: userId,
      userName: req.currentUser.name,
      title,
      content,
      codeSnippet: codeSnippet || "",
      mediaUrl: mediaUrl || "",
      category: category || "technical_update",
      hashtags: parsedHashtags,
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
};

// PUT /post/update/:id
export const updatePost = async (req, res) => {
  const { id } = req.params;
  const { title, content, codeSnippet, mediaUrl, category, hashtags } = req.body;

  try {
    const post = await Post.findById(id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (String(post.user) !== String(req.userid)) {
      return res.status(403).json({ message: "Not authorized to edit this post" });
    }

    if (title) post.title = title;
    if (content) post.content = content;
    if (codeSnippet !== undefined) post.codeSnippet = codeSnippet;
    if (mediaUrl !== undefined) post.mediaUrl = mediaUrl;
    if (category) post.category = category;
    if (hashtags) {
      post.hashtags = hashtags.map((h) => h.replace(/^#/, "").toLowerCase().trim());
    }

    await post.save();
    res.status(200).json(post);
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({ message: "Failed to update post" });
  }
};

// DELETE /post/delete/:id
export const deletePost = async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isOwner = String(post.user) === String(req.userid);
    const isAdmin = req.currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }

    await Post.findByIdAndDelete(id);
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
};

// PATCH /post/like/:id
export const toggleLike = async (req, res) => {
  const { id } = req.params;
  const userId = req.userid;

  try {
    const post = await Post.findById(id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ message: "Post not found" });
    }

    const likedIndex = post.likes.indexOf(userId);
    if (likedIndex === -1) {
      post.likes.push(userId);
      await createNotification({
        recipient: post.user,
        sender: userId,
        senderName: req.currentUser.name,
        type: "like",
        post: post._id,
      });
    } else {
      post.likes.splice(likedIndex, 1);
    }

    await post.save();
    await updateEngagementScore(post._id);

    res.status(200).json({ likesCount: post.likes.length, isLiked: likedIndex === -1 });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({ message: "Failed to like post" });
  }
};

// PATCH /post/bookmark/:id
export const toggleBookmark = async (req, res) => {
  const { id } = req.params;
  const userId = req.userid;

  try {
    const post = await Post.findById(id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ message: "Post not found" });
    }

    const index = post.bookmarks.indexOf(userId);
    if (index === -1) {
      post.bookmarks.push(userId);
    } else {
      post.bookmarks.splice(index, 1);
    }

    await post.save();
    res.status(200).json({ isBookmarked: index === -1 });
  } catch (error) {
    console.error("Toggle bookmark error:", error);
    res.status(500).json({ message: "Failed to bookmark post" });
  }
};

// POST /post/share/:id
export const sharePost = async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ message: "Post not found" });
    }

    post.sharesCount = (post.sharesCount || 0) + 1;
    await post.save();
    await updateEngagementScore(post._id);

    res.status(200).json({ sharesCount: post.sharesCount });
  } catch (error) {
    console.error("Share post error:", error);
    res.status(500).json({ message: "Failed to share post" });
  }
};

// POST /post/comment/:id
export const addComment = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.userid;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Comment content is required" });
  }

  try {
    const post = await Post.findById(id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = {
      user: userId,
      userName: req.currentUser.name,
      content: content.trim(),
      createdAt: new Date(),
      replies: [],
    };

    post.comments.push(comment);
    await post.save();
    await updateEngagementScore(post._id);

    await createNotification({
      recipient: post.user,
      sender: userId,
      senderName: req.currentUser.name,
      type: "comment",
      post: post._id,
    });

    res.status(201).json(post.comments);
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ message: "Failed to add comment" });
  }
};

// POST /post/comment/:id/reply/:commentId
export const addReply = async (req, res) => {
  const { id, commentId } = req.params;
  const { content } = req.body;
  const userId = req.userid;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Reply content is required" });
  }

  try {
    const post = await Post.findById(id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const reply = {
      user: userId,
      userName: req.currentUser.name,
      content: content.trim(),
      createdAt: new Date(),
    };

    comment.replies.push(reply);
    await post.save();

    await createNotification({
      recipient: comment.user,
      sender: userId,
      senderName: req.currentUser.name,
      type: "comment",
      post: post._id,
    });

    res.status(201).json(post.comments);
  } catch (error) {
    console.error("Add reply error:", error);
    res.status(500).json({ message: "Failed to add reply" });
  }
};

// POST /post/report/:id
export const reportPost = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.userid;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const alreadyReported = post.reports.some((r) => String(r.reportedBy) === String(userId));
    if (alreadyReported) {
      return res.status(400).json({ message: "You have already reported this post" });
    }

    post.reports.push({
      reportedBy: userId,
      reason: reason || "Inappropriate content",
      createdAt: new Date(),
    });

    await post.save();
    res.status(200).json({ message: "Post reported successfully" });
  } catch (error) {
    console.error("Report post error:", error);
    res.status(500).json({ message: "Failed to report post" });
  }
};

// Social Follow / Unfollow
// PATCH /post/user/follow/:targetUserId
export const toggleFollowUser = async (req, res) => {
  const { targetUserId } = req.params;
  const currentUserId = req.userid;

  if (String(currentUserId) === String(targetUserId)) {
    return res.status(400).json({ message: "You cannot follow yourself" });
  }

  try {
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      currentUser.following.pull(targetUserId);
      targetUser.followers.pull(currentUserId);
    } else {
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);

      await createNotification({
        recipient: targetUserId,
        sender: currentUserId,
        senderName: currentUser.name,
        type: "follow",
      });
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ isFollowing: !isFollowing });
  } catch (error) {
    console.error("Toggle follow error:", error);
    res.status(500).json({ message: "Failed to update follow status" });
  }
};

// Admin Moderation Endpoints
// GET /post/admin/reported
export const getReportedPosts = async (req, res) => {
  try {
    const reportedPosts = await Post.find({ "reports.0": { $exists: true } })
      .populate("user", "name email isSuspended")
      .sort({ "reports.length": -1 });

    res.status(200).json(reportedPosts);
  } catch (error) {
    console.error("Get reported posts error:", error);
    res.status(500).json({ message: "Failed to fetch reported posts" });
  }
};

// PATCH /post/admin/remove/:id
export const adminRemovePost = async (req, res) => {
  const { id } = req.params;
  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    post.isRemoved = true;
    await post.save();

    // Reputation Rule: -10 when an admin removes content
    await adjustReputation(
      post.user,
      -10,
      "admin_removal_deduction",
      `Admin removed post "${post.title}"`,
      String(post._id)
    );

    res.status(200).json({ message: "Post removed by admin" });
  } catch (error) {
    console.error("Admin remove post error:", error);
    res.status(500).json({ message: "Failed to remove post" });
  }
};


// PATCH /post/admin/suspend/:userId
export const adminSuspendUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const userToSuspend = await User.findById(userId);
    if (!userToSuspend) {
      return res.status(404).json({ message: "User not found" });
    }

    userToSuspend.isSuspended = !userToSuspend.isSuspended;
    await userToSuspend.save();

    res.status(200).json({
      message: userToSuspend.isSuspended
        ? "User account suspended"
        : "User account unsuspended",
      isSuspended: userToSuspend.isSuspended,
    });
  } catch (error) {
    console.error("Admin suspend user error:", error);
    res.status(500).json({ message: "Failed to update user suspension status" });
  }
};

// Notifications Endpoints
// GET /post/notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.userid })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("sender", "name")
      .populate("post", "title");

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// PATCH /post/notifications/read
export const markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.userid, read: false }, { read: true });
    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    res.status(500).json({ message: "Failed to mark notifications read" });
  }
};
