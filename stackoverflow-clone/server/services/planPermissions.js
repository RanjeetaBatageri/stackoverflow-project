import { getPlanConfig } from "../config/plans.js";
import User from "../models/auth.js";

export const getEffectivePlan = (user) => {
  if (!user) return "free";
  const status = user.subscriptionStatus;
  const plan = user.plan || "free";
  if (plan === "free") return "free";
  if (status === "active" || (status === "cancelled" && user.cancelAtPeriodEnd)) {
    return plan;
  }
  return "free";
};

export const getPlanLimits = (user) => {
  const planId = getEffectivePlan(user);
  return getPlanConfig(planId);
};

export const getDailyQuestionLimit = (user) => getPlanLimits(user).questionsPerDay;

export const canAskQuestion = (user, questionsAskedToday) => {
  const limit = getDailyQuestionLimit(user);
  if (limit === -1) return { allowed: true, limit: -1, used: questionsAskedToday, remaining: "unlimited" };
  return {
    allowed: questionsAskedToday < limit,
    limit,
    used: questionsAskedToday,
    remaining: Math.max(0, limit - questionsAskedToday),
  };
};

export const checkAndIncrementQuestionLimit = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return { allowed: false, error: "User not found" };
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD UTC date boundary

  let usedToday = user.dailyQuestionCount || 0;
  let lastDateStr = user.lastQuestionDate ? new Date(user.lastQuestionDate).toISOString().split("T")[0] : null;

  if (lastDateStr !== todayStr) {
    usedToday = 0;
  }

  const check = canAskQuestion(user, usedToday);
  if (!check.allowed) {
    const activePlan = getEffectivePlan(user);
    const recommendedPlan = activePlan === "free" ? "bronze" : activePlan === "bronze" ? "silver" : "gold";
    return {
      allowed: false,
      limit: check.limit,
      used: check.used,
      remaining: 0,
      currentPlan: activePlan,
      recommendedPlan,
      message: `Daily question limit reached for your ${activePlan.toUpperCase()} plan (${check.limit} question${check.limit > 1 ? "s" : ""}/day). Upgrade to ask more questions today!`,
    };
  }

  // Increment question count
  user.dailyQuestionCount = usedToday + 1;
  user.lastQuestionDate = today;
  await user.save();

  return {
    allowed: true,
    limit: check.limit,
    used: usedToday + 1,
    remaining: check.limit === -1 ? "unlimited" : Math.max(0, check.limit - (usedToday + 1)),
  };
};

export const canUseAdvancedSearch = (user) => {
  const search = getPlanLimits(user).search;
  return search === "advanced" || search === "priority";
};

export const canUsePrioritySearch = (user) => getPlanLimits(user).search === "priority";

export const getPremiumBadge = (user) => getPlanLimits(user).badge;

export const getProfileVisibility = (user) => getPlanLimits(user).profileVisibility;

export const hasPrioritySupport = (user) => getPlanLimits(user).prioritySupport;

export const hasGoldCommunityAccess = (user) => getPlanLimits(user).goldCommunity;

export const hasUnlimitedBookmarks = (user) => getPlanLimits(user).bookmarks === "unlimited";

export const getVisibilitySortScore = (user) => {
  const visibility = getProfileVisibility(user);
  if (visibility === "featured") return 3;
  if (visibility === "enhanced") return 2;
  return 1;
};

export const getSearchPriorityBoost = (planId) => {
  const config = getPlanConfig(planId);
  if (config.search === "priority") return 100;
  if (config.search === "advanced") return 10;
  return 0;
};
