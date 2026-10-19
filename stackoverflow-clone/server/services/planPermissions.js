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

export const checkQuestionLimit = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return { allowed: false, error: "User not found" };
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  let usedToday = user.dailyQuestionCount || 0;
  const lastDateStr = user.lastQuestionDate
    ? new Date(user.lastQuestionDate).toISOString().split("T")[0]
    : null;

  if (lastDateStr !== todayStr) {
    usedToday = 0;
  }

  const check = canAskQuestion(user, usedToday);

  if (!check.allowed) {
    const activePlan = getEffectivePlan(user);
    const recommendedPlan =
      activePlan === "free"
        ? "bronze"
        : activePlan === "bronze"
          ? "silver"
          : "gold";

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

  return {
    allowed: true,
    limit: check.limit,
    used: usedToday,
    remaining:
      check.limit === -1
        ? "unlimited"
        : Math.max(0, check.limit - usedToday),
  };
};

export const incrementQuestionLimit = async (userId) => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const user = await User.findById(userId);
  if (!user) return;

  const lastDateStr = user.lastQuestionDate
    ? new Date(user.lastQuestionDate).toISOString().split("T")[0]
    : null;

  if (lastDateStr !== todayStr) {
    // Reset count for new day atomically
    await User.findByIdAndUpdate(userId, {
      dailyQuestionCount: 1,
      lastQuestionDate: today,
    });
  } else {
    // Increment existing count for today atomically
    await User.findByIdAndUpdate(userId, {
      $inc: { dailyQuestionCount: 1 },
      lastQuestionDate: today,
    });
  }
};

export const checkAndIncrementQuestionLimit = async (userId) => {
  const check = await checkQuestionLimit(userId);
  if (!check.allowed) {
    return check;
  }
  await incrementQuestionLimit(userId);
  return {
    ...check,
    used: check.used + 1,
    remaining: check.limit === -1 ? "unlimited" : Math.max(0, check.limit - (check.used + 1)),
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
