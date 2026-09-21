import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PricingCard from "./PricingCard";
import { AlertTriangle, Lock } from "lucide-react";

interface LimitExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  currentPlan?: string;
  limit?: number;
}

export const LimitExceededModal: React.FC<LimitExceededModalProps> = ({
  isOpen,
  onClose,
  message,
  currentPlan = "free",
  limit = 1,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex items-center gap-3 text-amber-600 mb-1">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-950">
              <Lock className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold">Daily Question Limit Reached</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {message ||
              `You have reached your daily limit of ${limit} question${limit > 1 ? "s" : ""} on the ${currentPlan.toUpperCase()} plan.`}
            <br />
            Upgrade your membership tier below to ask more questions immediately!
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <PricingCard currentPlan={currentPlan} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LimitExceededModal;
