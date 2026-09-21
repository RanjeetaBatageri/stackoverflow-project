import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import PlanBadge from "./PlanBadge";
import PricingCard from "./PricingCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Calendar, ShieldCheck, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";

interface InvoiceItem {
  _id: string;
  invoiceNumber: string;
  plan: string;
  amount: number;
  currency: string;
  billingDate: string;
  status: string;
}

export const SubscriptionDashboard: React.FC = () => {
  const { user, subscription, fetchSubscription, updateUserState } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const res = await axiosInstance.get("/subscription/invoices");
      setInvoices(res.data.invoices || []);
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubscription();
      fetchInvoices();
    }
  }, [user?._id]);

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your active subscription? You will maintain access until the end of your billing cycle.")) {
      return;
    }

    setCancelling(true);
    try {
      await axiosInstance.post("/subscription/cancel");
      toast.success("Subscription scheduled for cancellation at period end");
      fetchSubscription();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, invoiceNum: string) => {
    try {
      const res = await axiosInstance.get(`/subscription/invoice/${invoiceId}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Invoice-${invoiceNum}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Downloaded Invoice #${invoiceNum}`);
    } catch (err) {
      toast.error("Failed to download invoice PDF");
    }
  };

  if (!user) return null;

  const currentPlan = subscription?.plan || user.plan || "free";
  const dailyQuestions = subscription?.dailyQuestions || { limit: 1, used: 0, remaining: 1 };

  const limitText = dailyQuestions.limit === -1 ? "Unlimited" : `${dailyQuestions.limit} / day`;
  const usedCount = dailyQuestions.used || 0;
  const progressPercent =
    dailyQuestions.limit === -1
      ? 100
      : Math.min(100, Math.round((usedCount / (dailyQuestions.limit || 1)) * 100));

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Current Subscription Summary Header Card */}
      <Card className="border shadow-xs bg-white dark:bg-gray-900">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl font-bold">Membership & Entitlements</CardTitle>
              <PlanBadge plan={currentPlan} badge={subscription?.badge} size="lg" />
            </div>
            <CardDescription className="mt-1 text-gray-500">
              Manage your active subscription plan, daily question usage, and billing receipts.
            </CardDescription>
          </div>

          <Button
            onClick={() => setShowPlans(!showPlans)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-medium"
          >
            {showPlans ? "Hide Plans" : "Upgrade / Change Plan"}
          </Button>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Usage Progress Card */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Daily Question Usage
                </span>
                <span className="text-xs font-bold text-orange-600">
                  {usedCount} / {limitText}
                </span>
              </div>

              {/* Custom Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    progressPercent >= 100 ? "bg-red-500" : "bg-orange-500"
                  }`}
                  style={{ width: `${dailyQuestions.limit === -1 ? 100 : progressPercent}%` }}
                ></div>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                {dailyQuestions.limit === -1
                  ? "Unlimited questions available today."
                  : `${dailyQuestions.remaining} question${dailyQuestions.remaining === 1 ? "" : "s"} remaining today.`}
              </p>
            </div>

            {/* Renewal & Status Card */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Billing & Status
                </span>
              </div>

              <div className="mt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="capitalize">{subscription?.subscriptionStatus || "Active"}</span>
                  {subscription?.cancelAtPeriodEnd && (
                    <span className="text-xs text-red-500 font-normal">(Cancelling at period end)</span>
                  )}
                </div>

                {subscription?.subscriptionEndDate && (
                  <p className="mt-1 text-xs text-gray-500">
                    Next billing date: {new Date(subscription.subscriptionEndDate).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>
            </div>

            {/* Support & Feature Entitlement Summary */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Active Features
                </span>
              </div>
              <ul className="mt-2 text-xs space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Search Access: {subscription?.planConfig?.search || "Basic"}</li>
                <li>• Profile Visibility: {subscription?.planConfig?.profileVisibility || "Standard"}</li>
                <li>• Bookmarks: {subscription?.planConfig?.bookmarks || "Standard"}</li>
              </ul>
            </div>
          </div>

          {currentPlan !== "free" && !subscription?.cancelAtPeriodEnd && (
            <div className="mt-6 text-right">
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="text-xs text-red-600 hover:text-red-700 underline font-medium"
              >
                {cancelling ? "Processing..." : "Cancel Subscription"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Cards Toggle */}
      {showPlans && (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-xl border">
          <PricingCard currentPlan={currentPlan} />
        </div>
      )}

      {/* Invoice Receipts Table */}
      <Card className="border shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Billing Receipts & Invoices
          </CardTitle>
          <CardDescription>Download tax invoices and payment history for your subscription.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingInvoices ? (
            <div className="text-center py-6 text-sm text-gray-500">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500">
              No invoice receipts found yet. Subscribe to a paid plan to view your receipts.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{inv.invoiceNumber}</td>
                      <td className="p-3 text-gray-600">{new Date(inv.billingDate).toLocaleDateString("en-IN")}</td>
                      <td className="p-3 capitalize font-medium">{inv.plan}</td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                        ₹{inv.amount} {inv.currency}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(inv._id, inv.invoiceNumber)}
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionDashboard;
