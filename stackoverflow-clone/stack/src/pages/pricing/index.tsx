import React from "react";
import Mainlayout from "@/layout/Mainlayout";
import PricingCard from "@/components/subscription/PricingCard";
import { useAuth } from "@/lib/AuthContext";

const PricingPage = () => {
  const { user } = useAuth();

  return (
    <Mainlayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <PricingCard currentPlan={user?.plan || "free"} />
      </div>
    </Mainlayout>
  );
};

export default PricingPage;
