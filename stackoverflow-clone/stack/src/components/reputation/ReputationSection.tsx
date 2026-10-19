import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Award, History, Send, Lock, CheckCircle2, ShieldCheck } from "lucide-react";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "react-toastify";

interface ReputationSectionProps {
  userId: string;
  isOwnProfile: boolean;
  userReputation: number;
}

const PRIVILEGES = [
  { min: 50, name: "Comment on posts & answers", key: "comment" },
  { min: 100, name: "Edit questions & answers", key: "edit" },
  { min: 250, name: "Close vote questions", key: "close_vote" },
  { min: 500, name: "Report inappropriate content", key: "report" },
];

export const ReputationSection: React.FC<ReputationSectionProps> = ({
  userId,
  isOwnProfile,
  userReputation = 0,
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Transfer state
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await axiosInstance.get(`/user/reputation/history/${userId}`);
      setHistory(res.data || []);
    } catch (err) {
      console.error("Failed to fetch reputation history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchHistory();
    }
  }, [userId]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId.trim() || !amount) {
      toast.error("Please fill in recipient user ID and amount");
      return;
    }
    const numAmt = Number(amount);
    if (numAmt <= 0 || numAmt > 50) {
      toast.error("Transfer amount must be between 1 and 50 reputation");
      return;
    }

    try {
      setTransferring(true);
      const res = await axiosInstance.post("/user/reputation/transfer", {
        recipientId: recipientId.trim(),
        amount: numAmt,
        reason: reason.trim(),
      });
      toast.success(res.data.message || "Reputation transferred successfully!");
      setRecipientId("");
      setAmount("");
      setReason("");
      fetchHistory();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  // Find next privilege
  const nextPrivilege = PRIVILEGES.find((p) => userReputation < p.min);
  const currentLevelIndex = PRIVILEGES.filter((p) => userReputation >= p.min).length;

  return (
    <div className="space-y-6">
      {/* Top Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-100">Total Reputation</p>
                <h2 className="text-4xl font-extrabold mt-1">{userReputation}</h2>
              </div>
              <Award className="w-12 h-12 opacity-80" />
            </div>
            <p className="text-xs text-amber-100 mt-4">
              Earned by contributing quality questions, answers, and community engagement.
            </p>
          </CardContent>
        </Card>

        {/* Badges / Tier */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-500" /> Earned Badges & Tier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {userReputation >= 500 && (
                <Badge className="bg-amber-600 hover:bg-amber-700 text-white">Gold Contributor</Badge>
              )}
              {userReputation >= 100 && (
                <Badge className="bg-slate-500 hover:bg-slate-600 text-white">Silver Editor</Badge>
              )}
              {userReputation >= 50 && (
                <Badge className="bg-amber-800 hover:bg-amber-900 text-white">Bronze Member</Badge>
              )}
              {userReputation < 50 && (
                <Badge variant="outline" className="text-gray-500">New Community Member</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Unlocked {currentLevelIndex} of {PRIVILEGES.length} community privileges.
            </p>
          </CardContent>
        </Card>

        {/* Progress towards Next Privilege */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Next Privilege Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextPrivilege ? (
              <>
                <div className="flex justify-between text-xs font-medium">
                  <span>{nextPrivilege.name}</span>
                  <span>{userReputation} / {nextPrivilege.min} rep</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, (userReputation / nextPrivilege.min) * 100))}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Need {nextPrivilege.min - userReputation} more reputation points to unlock.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-green-600 text-sm font-semibold py-2">
                <CheckCircle2 className="w-5 h-5" /> All community privileges unlocked!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Privileges Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-500" /> Privileges & Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRIVILEGES.map((p) => {
              const isUnlocked = userReputation >= p.min;
              return (
                <div
                  key={p.key}
                  className={`p-4 rounded-lg border ${
                    isUnlocked
                      ? "border-green-300 bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-200"
                      : "border-gray-200 bg-gray-50 dark:bg-gray-800/40 text-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={isUnlocked ? "default" : "secondary"} className={isUnlocked ? "bg-green-600" : ""}>
                      {p.min} Rep
                    </Badge>
                    {isUnlocked ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Lock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm font-semibold">{p.name}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Reputation Transfer Form (Only for own profile) */}
      {isOwnProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-500" /> Transfer Reputation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userReputation <= 50 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm">
                <strong>Privilege Locked:</strong> You must have more than 50 reputation points to transfer reputation to other members. (Current: {userReputation})
              </div>
            ) : (
              <form onSubmit={handleTransfer} className="space-y-4 max-w-xl">
                <div>
                  <Label htmlFor="recipientId">Recipient User ID</Label>
                  <Input
                    id="recipientId"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    placeholder="Enter recipient MongoDB User ID"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (Max 50 per transfer)</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="1"
                      max="50"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="1 - 50"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason (Optional)</Label>
                    <Input
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., Helpful answer bounty"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={transferring}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {transferring ? "Processing..." : "Transfer Reputation"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reputation Audit History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-orange-500" /> Reputation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="py-8 text-center text-gray-500">Loading reputation log...</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No reputation transactions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                <thead className="text-xs uppercase bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Change</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4">Resulting Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {history.map((log: any) => (
                    <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="py-3 px-4 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold whitespace-nowrap">
                        <span className={log.amount >= 0 ? "text-green-600" : "text-red-600"}>
                          {log.amount >= 0 ? `+${log.amount}` : log.amount}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium capitalize whitespace-nowrap">
                        {log.reason?.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate">{log.details || "-"}</td>
                      <td className="py-3 px-4 font-semibold">{log.resultingBalance}</td>
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

export default ReputationSection;
