import User from "../models/auth.js";
import ReputationLog from "../models/reputationLog.js";

/**
 * Safely update user reputation and create an audit record
 */
export const adjustReputation = async (userId, delta, reason, details = "", relatedId = "") => {
  if (!userId || delta === 0) return null;

  // Prevent duplicate one-time awards if relatedId & reason match
  if (relatedId) {
    const existing = await ReputationLog.findOne({ user: userId, reason, relatedId });
    if (existing) {
      return existing; // already awarded
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { reputation: delta } },
    { new: true }
  );

  if (!updatedUser) return null;

  // Prevent negative balance
  if (updatedUser.reputation < 0) {
    updatedUser.reputation = 0;
    await updatedUser.save();
  }

  const log = await ReputationLog.create({
    user: userId,
    amount: delta,
    reason,
    details,
    relatedId,
    resultingBalance: updatedUser.reputation,
  });

  return log;
};

export const REPUTATION_PRIVILEGES = [
  { min: 50, name: "Comment on posts & answers", key: "comment" },
  { min: 100, name: "Edit questions & answers", key: "edit" },
  { min: 250, name: "Close vote questions", key: "close_vote" },
  { min: 500, name: "Report inappropriate content", key: "report" },
];

export const checkPrivilege = (userReputation, requiredRep) => {
  return (userReputation || 0) >= requiredRep;
};
