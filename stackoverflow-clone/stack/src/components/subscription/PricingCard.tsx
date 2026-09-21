import React, { useState } from "react";
import { Check, Zap, Crown, Award, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "react-toastify";
import { useRouter } from "next/router";

// Helper to dynamically load Razorpay script
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface PlanDefinition {
  id: "free" | "bronze" | "silver" | "gold";
  name: string;
  price: number;
  badge: string | null;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  buttonVariant: "outline" | "default";
  features: PlanFeature[];
}

const PLAN_LIST: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    badge: null,
    description: "Essential access for community learners",
    icon: <Zap className="w-6 h-6 text-gray-500" />,
    accentColor: "border-gray-200 dark:border-gray-800",
    buttonVariant: "outline",
    features: [
      { text: "1 question per day", included: true },
      { text: "Basic search", included: true },
      { text: "Standard profile", included: true },
      { text: "Community badges", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    id: "bronze",
    name: "Bronze",
    price: 99,
    badge: "bronze",
    description: "Great for active learners & developers",
    icon: <Award className="w-6 h-6 text-amber-600" />,
    accentColor: "border-amber-400 dark:border-amber-700 hover:shadow-amber-100",
    buttonVariant: "outline",
    features: [
      { text: "5 questions per day", included: true, highlight: true },
      { text: "Bronze badge profile flair", included: true },
      { text: "Advanced search filters", included: true },
      { text: "Standard bookmarks", included: true },
      { text: "Priority support", included: false },
    ],
  },
  {
    id: "silver",
    name: "Silver",
    price: 299,
    badge: "silver",
    description: "Ideal for regular contributors & pros",
    icon: <ShieldCheck className="w-6 h-6 text-slate-500" />,
    accentColor: "border-slate-400 dark:border-slate-600 shadow-sm",
    buttonVariant: "default",
    features: [
      { text: "15 questions per day", included: true, highlight: true },
      { text: "Silver badge profile flair", included: true },
      { text: "Advanced search filters", included: true },
      { text: "Unlimited bookmarks", included: true },
      { text: "Priority email support", included: true },
      { text: "Enhanced profile visibility", included: true },
    ],
  },
  {
    id: "gold",
    name: "Gold Pro",
    price: 999,
    badge: "gold",
    description: "Ultimate power-user pass for experts",
    icon: <Crown className="w-6 h-6 text-yellow-500" />,
    accentColor: "border-yellow-400 bg-gradient-to-b from-amber-50/50 to-orange-50/20 dark:from-yellow-950/20 dark:to-orange-950/10 shadow-md",
    buttonVariant: "default",
    features: [
      { text: "UNLIMITED questions / day", included: true, highlight: true },
      { text: "Exclusive Gold badge flair", included: true },
      { text: "Highest search priority boost", included: true },
      { text: "Featured profile visibility", included: true },
      { text: "Unlimited bookmarks", included: true },
      { text: "Priority 24/7 customer support", included: true },
      { text: "Exclusive Gold community features", included: true },
    ],
  },
];

export const PricingCard: React.FC<{ currentPlan?: string }> = ({ currentPlan = "free" }) => {
  const { user, updateUserState } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: "bronze" | "silver" | "gold") => {
    if (!user) {
      toast.error("Please login to select a subscription plan");
      router.push("/auth");
      return;
    }

    if (user.plan === planId) {
      toast.info(`You are already subscribed to the ${planId.toUpperCase()} plan.`);
      return;
    }

    setLoadingPlan(planId);

    try {
      // 1. Create order on backend
      const res = await axiosInstance.post("/subscription/create-order", { plan: planId });
      const { orderId, subscriptionId, amount, currency, keyId, user: userInfo } = res.data;

      // 2. Load Razorpay Checkout SDK
      const loaded = await loadRazorpayScript();

      if (loaded && (window as any).Razorpay && keyId && !keyId.includes("mock")) {
        const options = {
          key: keyId,
          amount,
          currency,
          name: "Stack Overflow Clone",
          description: `${planId.toUpperCase()} Plan Subscription`,
          order_id: orderId,
          subscription_id: subscriptionId,
          prefill: {
            name: userInfo?.name || user.name,
            email: userInfo?.email || user.email,
          },
          theme: {
            color: "#f97316",
          },
          handler: async (response: any) => {
            try {
              // 3. Verify signature securely on backend
              const verifyRes = await axiosInstance.post("/subscription/verify", {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id || orderId,
                razorpay_subscription_id: response.razorpay_subscription_id || subscriptionId,
                razorpay_signature: response.razorpay_signature,
                plan: planId,
              });

              if (verifyRes.data.success) {
                toast.success(verifyRes.data.message || `Subscribed to ${planId.toUpperCase()} successfully!`);
                updateUserState({ plan: planId, subscriptionStatus: "active" });
              }
            } catch (err: any) {
              toast.error(err.response?.data?.message || "Payment verification failed");
            } finally {
              setLoadingPlan(null);
            }
          },
          modal: {
            ondismiss: () => {
              toast.info("Payment process cancelled");
              setLoadingPlan(null);
            },
          },
        };

        const razorpayObj = new (window as any).Razorpay(options);
        razorpayObj.open();
      } else {
        // Fallback testing verification for local demo when live keys are mock/unset
        const verifyRes = await axiosInstance.post("/subscription/verify", {
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_order_id: orderId || `order_mock_${Date.now()}`,
          razorpay_subscription_id: subscriptionId,
          razorpay_signature: "mock_signature_valid",
          plan: planId,
        });

        if (verifyRes.data.success) {
          toast.success(`[Demo Mode] Activated ${planId.toUpperCase()} Plan!`);
          updateUserState({ plan: planId, subscriptionStatus: "active" });
        }
        setLoadingPlan(null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to initiate subscription payment");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="w-full py-6">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Choose Your Membership Tier
        </h2>
        <p className="mt-2 text-sm lg:text-base text-gray-600 dark:text-gray-400">
          Unlock higher daily question limits, priority support, advanced search features, and exclusive badges.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLAN_LIST.map((p) => {
          const isCurrent = (user?.plan || currentPlan) === p.id;
          const isLoading = loadingPlan === p.id;

          return (
            <Card
              key={p.id}
              className={`flex flex-col justify-between transition-all duration-200 ${p.accentColor} ${
                isCurrent ? "ring-2 ring-orange-500 shadow-md" : ""
              }`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/50">{p.icon}</div>
                  {isCurrent && (
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      Current Active Plan
                    </span>
                  )}
                </div>
                <CardTitle className="text-xl font-bold">{p.name}</CardTitle>
                <p className="text-xs text-gray-500 min-h-8">{p.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">₹{p.price}</span>
                  <span className="text-sm font-medium text-gray-500"> / month</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-sm flex-1">
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                  {p.features.map((f, idx) => (
                    <div key={idx} className="flex items-start gap-2 py-1">
                      <Check
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          f.included ? "text-green-600 dark:text-green-400" : "text-gray-300 dark:text-gray-700"
                        }`}
                      />
                      <span
                        className={`${
                          f.included
                            ? f.highlight
                              ? "font-semibold text-gray-900 dark:text-gray-100"
                              : "text-gray-700 dark:text-gray-300"
                            : "text-gray-400 line-through dark:text-gray-600"
                        }`}
                      >
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="pt-4">
                {p.id === "free" ? (
                  <Button variant="outline" className="w-full text-gray-600" disabled={isCurrent}>
                    {isCurrent ? "Default Plan" : "Free Plan"}
                  </Button>
                ) : (
                  <Button
                    variant={p.buttonVariant}
                    disabled={isCurrent || isLoading}
                    onClick={() => handleSubscribe(p.id as any)}
                    className={`w-full font-medium ${
                      p.id === "gold"
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm"
                        : "bg-orange-600 hover:bg-orange-700 text-white"
                    }`}
                  >
                    {isLoading ? (
                      "Processing..."
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : (
                      <>
                        <span>Subscribe ₹{p.price}/mo</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PricingCard;
