import React, { useEffect, useState } from "react";
import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "react-toastify";
import {
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  TrendingUp,
  Flame,
  UserPlus,
  UserCheck,
  Flag,
  Trash2,
  Edit,
  Bell,
  Code,
  Image as ImageIcon,
  Send,
  ShieldAlert,
} from "lucide-react";

export default function CommunityPage() {
  const { user } = useAuth();
  const [feedType, setFeedType] = useState<"all" | "personalized" | "trending">("all");
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [trendingTags, setTrendingTags] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  
  // Post creation modal / form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [category, setCategory] = useState("technical_update");
  const [hashtagsStr, setHashtagsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Comment input state per post
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);

  // Admin moderation state
  const [isAdminView, setIsAdminView] = useState(false);
  const [reportedPosts, setReportedPosts] = useState<any[]>([]);

  const fetchFeed = async (pageNum = 1, append = false, type = feedType, tag = selectedTag) => {
    setLoading(true);
    try {
      let url = `/post/feed?feedType=${type}&page=${pageNum}&limit=5`;
      if (tag) url += `&hashtag=${encodeURIComponent(tag)}`;

      const res = await axiosInstance.get(url);
      if (append) {
        setPosts((prev) => [...prev, ...res.data.posts]);
      } else {
        setPosts(res.data.posts || []);
      }
      setTotalPages(res.data.totalPages || 1);
      setPage(pageNum);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingHashtags = async () => {
    try {
      const res = await axiosInstance.get("/post/trending-hashtags");
      setTrendingTags(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get("/post/notifications");
      setNotifications(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReportedPosts = async () => {
    if (user?.role !== "admin") return;
    try {
      const res = await axiosInstance.get("/post/admin/reported");
      setReportedPosts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFeed(1, false, feedType, selectedTag);
    fetchTrendingHashtags();
    if (user) {
      fetchNotifications();
      if (user.role === "admin") fetchReportedPosts();
    }
  }, [feedType, selectedTag, user]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to publish post");
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    setSubmitting(true);
    try {
      const parsedTags = hashtagsStr
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      await axiosInstance.post("/post/create", {
        title,
        content,
        codeSnippet,
        mediaUrl,
        category,
        hashtags: parsedTags,
      });

      toast.success("Post published to community feed!");
      setTitle("");
      setContent("");
      setCodeSnippet("");
      setMediaUrl("");
      setHashtagsStr("");
      fetchFeed(1, false);
      fetchTrendingHashtags();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return toast.info("Please login to like posts");
    try {
      const res = await axiosInstance.patch(`/post/like/${postId}`);
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            const isLiked = res.data.isLiked;
            const updatedLikes = isLiked
              ? [...p.likes, user._id]
              : p.likes.filter((id: string) => id !== user._id);
            return { ...p, likes: updatedLikes };
          }
          return p;
        })
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to like post");
    }
  };

  const handleBookmark = async (postId: string) => {
    if (!user) return toast.info("Please login to bookmark posts");
    try {
      const res = await axiosInstance.patch(`/post/bookmark/${postId}`);
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            const isBookmarked = res.data.isBookmarked;
            const updatedBookmarks = isBookmarked
              ? [...p.bookmarks, user._id]
              : p.bookmarks.filter((id: string) => id !== user._id);
            return { ...p, bookmarks: updatedBookmarks };
          }
          return p;
        })
      );
      toast.success(res.data.isBookmarked ? "Post saved" : "Bookmark removed");
    } catch (err: any) {
      toast.error("Failed to bookmark post");
    }
  };

  const handleShare = async (postId: string) => {
    try {
      const res = await axiosInstance.post(`/post/share/${postId}`);
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, sharesCount: res.data.sharesCount } : p))
      );
      toast.success("Post share count updated!");
    } catch (err) {
      toast.error("Failed to share post");
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user) return toast.info("Please login to comment");
    const commentText = commentInputs[postId];
    if (!commentText || !commentText.trim()) return;

    try {
      const res = await axiosInstance.post(`/post/comment/${postId}`, {
        content: commentText.trim(),
      });
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, comments: res.data } : p))
      );
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      toast.success("Comment added");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add comment");
    }
  };

  const handleAddReply = async (postId: string, commentId: string) => {
    if (!user) return toast.info("Please login to reply");
    const replyText = replyInputs[commentId];
    if (!replyText || !replyText.trim()) return;

    try {
      const res = await axiosInstance.post(`/post/comment/${postId}/reply/${commentId}`, {
        content: replyText.trim(),
      });
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, comments: res.data } : p))
      );
      setReplyInputs((prev) => ({ ...prev, [commentId]: "" }));
      setActiveReplyCommentId(null);
      toast.success("Reply added");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add reply");
    }
  };

  const handleReport = async (postId: string) => {
    if (!user) return toast.info("Please login to report posts");
    const reason = prompt("Enter reason for reporting this post:", "Inappropriate content");
    if (!reason) return;

    try {
      await axiosInstance.post(`/post/report/${postId}`, { reason });
      toast.success("Post reported to administrators");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to report post");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await axiosInstance.delete(`/post/delete/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      toast.success("Post deleted");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete post");
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!user) return toast.info("Please login to follow members");
    try {
      const res = await axiosInstance.patch(`/post/user/follow/${targetUserId}`);
      toast.success(res.data.isFollowing ? "User followed" : "User unfollowed");
      fetchFeed(1, false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update follow status");
    }
  };

  // Admin moderation actions
  const handleAdminRemove = async (postId: string) => {
    try {
      await axiosInstance.patch(`/post/admin/remove/${postId}`);
      toast.success("Post removed by admin");
      fetchReportedPosts();
      fetchFeed(1, false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove post");
    }
  };

  const handleAdminSuspend = async (userId: string) => {
    try {
      const res = await axiosInstance.patch(`/post/admin/suspend/${userId}`);
      toast.success(res.data.message);
      fetchReportedPosts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to suspend user");
    }
  };

  return (
    <Mainlayout>
      <div className="max-w-6xl mx-auto py-6">
        {/* Header & Notifications */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Flame className="w-7 h-7 text-orange-500" /> Community Feed
            </h1>
            <p className="text-sm text-gray-600">
              Share technical updates, code snippets, showcases, and learning milestones.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <Button
                variant={isAdminView ? "destructive" : "outline"}
                size="sm"
                onClick={() => setIsAdminView(!isAdminView)}
              >
                <ShieldAlert className="w-4 h-4 mr-1" />
                {isAdminView ? "Back to Feed" : `Admin Moderation (${reportedPosts.length})`}
              </Button>
            )}

            {user && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    axiosInstance.patch("/post/notifications/read");
                  }}
                  className="relative"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.some((n) => !n.read) && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full"></span>
                  )}
                </Button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 max-h-80 overflow-y-auto">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notifications</h3>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-500">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n._id} className="text-xs py-1.5 border-b last:border-b-0">
                          <span className="font-semibold">{n.senderName}</span>{" "}
                          {n.type === "like" && "liked your post"}
                          {n.type === "comment" && "commented on your post"}
                          {n.type === "follow" && "started following you"}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isAdminView ? (
          /* Admin Moderation Panel */
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Reported Posts for Review
            </h2>
            {reportedPosts.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-gray-500">No reported posts.</CardContent></Card>
            ) : (
              reportedPosts.map((rp) => (
                <Card key={rp._id} className="border-red-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900">{rp.title}</h3>
                        <p className="text-sm text-gray-700 mt-1">{rp.content}</p>
                        <p className="text-xs text-red-600 mt-2">
                          Reports count: {rp.reports?.length} | Author: {rp.user?.name} ({rp.user?.email})
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => handleAdminRemove(rp._id)}>
                          Remove Post
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAdminSuspend(rp.user?._id)}>
                          {rp.user?.isSuspended ? "Unsuspend User" : "Suspend User"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          /* Main Feed View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Posts Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Create Post Form */}
              {user && (
                <Card className="border-orange-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-gray-800">
                      Share with the Developer Community
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreatePost} className="space-y-3">
                      <Input
                        placeholder="Title of your post / snippet / showcase..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      <Textarea
                        placeholder="What are you building, learning, or working on?"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="min-h-24"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="Optional image/media URL..."
                          value={mediaUrl}
                          onChange={(e) => setMediaUrl(e.target.value)}
                        />
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          <option value="technical_update">Technical Update</option>
                          <option value="code_snippet">Code Snippet</option>
                          <option value="project_showcase">Project Showcase</option>
                          <option value="achievement">Learning Achievement</option>
                        </select>
                      </div>
                      <Textarea
                        placeholder="Optional code snippet..."
                        value={codeSnippet}
                        onChange={(e) => setCodeSnippet(e.target.value)}
                        className="font-mono text-xs min-h-20"
                      />
                      <Input
                        placeholder="Hashtags (e.g. react, nodejs, webdev)"
                        value={hashtagsStr}
                        onChange={(e) => setHashtagsStr(e.target.value)}
                      />
                      <Button type="submit" disabled={submitting} className="bg-orange-600 hover:bg-orange-700 text-white w-full">
                        {submitting ? "Publishing..." : "Publish Post"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Feed Tabs */}
              <div className="flex gap-2 border-b pb-2">
                <Button
                  variant={feedType === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setFeedType("all"); setSelectedTag(""); }}
                >
                  All Posts
                </Button>
                {user && (
                  <Button
                    variant={feedType === "personalized" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => { setFeedType("personalized"); setSelectedTag(""); }}
                  >
                    Following Feed
                  </Button>
                )}
                <Button
                  variant={feedType === "trending" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setFeedType("trending"); setSelectedTag(""); }}
                >
                  <TrendingUp className="w-4 h-4 mr-1" /> Trending
                </Button>
                {selectedTag && (
                  <Badge variant="secondary" className="ml-auto bg-orange-100 text-orange-800">
                    #{selectedTag} <button onClick={() => setSelectedTag("")} className="ml-1 text-xs font-bold">×</button>
                  </Badge>
                )}
              </div>

              {/* Feed Posts List */}
              {loading && posts.length === 0 ? (
                <div className="flex justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                </div>
              ) : posts.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-gray-500">No posts in community feed yet.</CardContent></Card>
              ) : (
                posts.map((post) => {
                  const isLiked = post.likes?.includes(user?._id);
                  const isBookmarked = post.bookmarks?.includes(user?._id);
                  const isOwner = user?._id === post.user?._id || user?._id === post.user;

                  return (
                    <Card key={post._id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-5 space-y-4">
                        {/* Author Header */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              <AvatarFallback className="bg-orange-100 text-orange-800 font-bold">
                                {post.userName?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                {post.userName}
                                {user && !isOwner && (
                                  <button
                                    onClick={() => handleToggleFollow(post.user?._id || post.user)}
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                                  >
                                    <UserPlus className="w-3 h-3" /> Follow
                                  </button>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(post.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs uppercase tracking-wider">
                            {post.category?.replace("_", " ")}
                          </Badge>
                        </div>

                        {/* Title & Body */}
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{post.title}</h3>
                          <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
                            {post.content}
                          </p>
                        </div>

                        {/* Media */}
                        {post.mediaUrl && (
                          <div className="rounded-lg overflow-hidden border max-h-80 bg-gray-50 flex justify-center">
                            <img src={post.mediaUrl} alt="post attachment" className="object-contain max-h-80" />
                          </div>
                        )}

                        {/* Code Snippet */}
                        {post.codeSnippet && (
                          <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs font-mono overflow-x-auto">
                            <code>{post.codeSnippet}</code>
                          </pre>
                        )}

                        {/* Hashtags */}
                        {post.hashtags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {post.hashtags.map((tag: string) => (
                              <span
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                className="text-xs text-blue-600 hover:underline cursor-pointer font-medium"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Action Toolbar */}
                        <div className="flex items-center justify-between pt-2 border-t text-sm text-gray-600">
                          <button
                            onClick={() => handleLike(post._id)}
                            className={`flex items-center gap-1 hover:text-red-500 ${
                              isLiked ? "text-red-500 font-bold" : ""
                            }`}
                          >
                            <Heart className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} />
                            <span>{post.likes?.length || 0}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            <span>{post.comments?.length || 0}</span>
                          </div>

                          <button onClick={() => handleShare(post._id)} className="flex items-center gap-1 hover:text-blue-600">
                            <Share2 className="w-4 h-4" />
                            <span>{post.sharesCount || 0}</span>
                          </button>

                          <button
                            onClick={() => handleBookmark(post._id)}
                            className={`hover:text-yellow-500 ${isBookmarked ? "text-yellow-500 font-bold" : ""}`}
                          >
                            <Bookmark className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} />
                          </button>

                          {isOwner && (
                            <button onClick={() => handleDeletePost(post._id)} className="hover:text-red-600 text-gray-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <button onClick={() => handleReport(post._id)} className="hover:text-orange-600 text-gray-400">
                            <Flag className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Comments Section */}
                        <div className="pt-3 space-y-3 bg-gray-50 p-3 rounded-lg border">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Write a comment..."
                              value={commentInputs[post._id] || ""}
                              onChange={(e) =>
                                setCommentInputs({ ...commentInputs, [post._id]: e.target.value })
                              }
                              className="text-xs h-8"
                            />
                            <Button size="sm" className="h-8 text-xs bg-orange-600 hover:bg-orange-700" onClick={() => handleAddComment(post._id)}>
                              <Send className="w-3 h-3" />
                            </Button>
                          </div>

                          {/* Comments List */}
                          {post.comments?.map((c: any) => (
                            <div key={c._id} className="text-xs space-y-1 pl-1 border-l-2 border-orange-200">
                              <div className="flex justify-between">
                                <span className="font-bold text-gray-800">{c.userName}</span>
                                <span className="text-[10px] text-gray-500">
                                  {new Date(c.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-700">{c.content}</p>

                              <button
                                onClick={() => setActiveReplyCommentId(activeReplyCommentId === c._id ? null : c._id)}
                                className="text-[10px] text-blue-600 hover:underline"
                              >
                                Reply
                              </button>

                              {/* Nested Replies */}
                              {c.replies?.map((r: any) => (
                                <div key={r._id} className="ml-3 pl-2 border-l text-[11px] text-gray-600 py-0.5">
                                  <span className="font-semibold">{r.userName}:</span> {r.content}
                                </div>
                              ))}

                              {/* Reply Input */}
                              {activeReplyCommentId === c._id && (
                                <div className="flex gap-1 mt-1 pl-3">
                                  <Input
                                    placeholder="Write a reply..."
                                    value={replyInputs[c._id] || ""}
                                    onChange={(e) =>
                                      setReplyInputs({ ...replyInputs, [c._id]: e.target.value })
                                    }
                                    className="text-[11px] h-7"
                                  />
                                  <Button size="sm" className="h-7 text-[10px]" onClick={() => handleAddReply(post._id, c._id)}>
                                    Reply
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Server-side Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => fetchFeed(page - 1, false)}
                  >
                    Previous Page
                  </Button>
                  <span className="text-sm flex items-center px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => fetchFeed(page + 1, false)}
                  >
                    Next Page
                  </Button>
                </div>
              )}
            </div>

            {/* Sidebar Column (Trending Hashtags) */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-800">
                    <TrendingUp className="w-4 h-4 text-orange-500" /> Trending Topics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {trendingTags.length === 0 ? (
                    <p className="text-xs text-gray-500">No hashtags yet.</p>
                  ) : (
                    trendingTags.map((t) => (
                      <div
                        key={t.tag}
                        onClick={() => setSelectedTag(t.tag)}
                        className="flex justify-between items-center text-xs p-2 hover:bg-orange-50 rounded cursor-pointer transition-colors"
                      >
                        <span className="font-semibold text-blue-600">#{t.tag}</span>
                        <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full text-[10px]">
                          {t.count} posts
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Mainlayout>
  );
}
