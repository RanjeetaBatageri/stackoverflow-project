import React from "react";
import { Award, ShieldCheck, Crown } from "lucide-react";

interface PlanBadgeProps {
  plan?: string | null;
  badge?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({ plan, badge, className = "", size = "md" }) => {
  const currentBadge = badge || (plan && plan !== "free" ? plan : null);
  if (!currentBadge) return null;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5 font-medium",
    lg: "px-3 py-1.5 text-sm gap-2 font-semibold",
  };

  const badgeConfig: Record<string, { label: string; icon: React.ReactNode; style: string }> = {
    bronze: {
      label: "Bronze Member",
      icon: <Award className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
      style: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
    },
    silver: {
      label: "Silver Member",
      icon: <ShieldCheck className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
      style: "bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600",
    },
    gold: {
      label: "Gold Pro",
      icon: <Crown className={size === "sm" ? "w-3 h-3 text-yellow-600" : "w-4 h-4 text-yellow-600"} />,
      style: "bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 text-yellow-950 border-yellow-400 shadow-sm font-bold dark:from-yellow-900 dark:to-amber-900 dark:text-yellow-100",
    },
  };

  const config = badgeConfig[currentBadge.toLowerCase()];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs transition-colors ${sizeClasses[size]} ${config.style} ${className}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

export default PlanBadge;
