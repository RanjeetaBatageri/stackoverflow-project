import React, { useEffect, useState } from "react";
import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-toastify";
import { Shield, Laptop, Smartphone, Monitor, Trash2, ShieldAlert, LogOut, Clock, MapPin, CheckCircle } from "lucide-react";

export default function SecurityPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, logsRes] = await Promise.all([
        axiosInstance.get("/user/sessions"),
        axiosInstance.get("/user/security-logs"),
      ]);
      setSessions(sessionsRes.data || []);
      setLogs(logsRes.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load security data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSecurityData();
    } else if (user === null) {
      toast.info("Session expired or logged out");
      window.location.href = "/auth";
    }
  }, [user]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to revoke this session?")) return;
    setRevoking(sessionId);
    try {
      await axiosInstance.delete(`/user/sessions/${sessionId}`);
      toast.success("Session revoked");
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm("Are you sure you want to log out all other active devices?")) return;
    try {
      await axiosInstance.delete("/user/sessions/other");
      toast.success("All other active sessions revoked");
      fetchSecurityData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to revoke other sessions");
    }
  };

  return (
    <Mainlayout>
      <div className="max-w-5xl mx-auto py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" /> Account Security & Active Devices
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your active sessions, recognized devices, and view security audit logs.
          </p>
        </div>

        {/* Active Sessions Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Active Sessions & Devices</CardTitle>
              <CardDescription>
                Devices currently logged into your Stack Overflow account
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevokeOthers}
                className="flex items-center gap-1 text-xs"
              >
                <LogOut className="w-3.5 h-3.5" /> Revoke Other Devices
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-center text-gray-500 py-6 text-sm">No active sessions found.</p>
            ) : (
              sessions.map((s) => {
                const isCurrent = user?.sessionId === s.sessionId;
                return (
                  <div
                    key={s.sessionId}
                    className={`p-4 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                      isCurrent ? "bg-blue-50/50 border-blue-200" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-gray-100 rounded-lg text-gray-700 mt-0.5">
                        {s.deviceType === "mobile" ? (
                          <Smartphone className="w-5 h-5" />
                        ) : (
                          <Monitor className="w-5 h-5" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-sm">
                            {s.browser} on {s.os}
                          </span>
                          {isCurrent && (
                            <Badge className="bg-green-600 hover:bg-green-700 text-xs">
                              Current Session
                            </Badge>
                          )}
                          {s.isTrusted && (
                            <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Trusted Device
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> IP: {s.ipAddress}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last active: {new Date(s.lastActive).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revoking === s.sessionId}
                        onClick={() => handleRevokeSession(s.sessionId)}
                        className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {revoking === s.sessionId ? "Revoking..." : "Revoke Session"}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Security Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-gray-700" /> Security Audit Logs
            </CardTitle>
            <CardDescription>
              Recent security events and authentication activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-6">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-600"></div>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No security logs recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log._id} className="p-3 bg-gray-50 rounded text-xs flex justify-between items-center border">
                    <div>
                      <span className="font-semibold text-gray-800 uppercase tracking-wider">
                        {log.event.replace(/_/g, " ")}
                      </span>
                      <p className="text-gray-600 mt-0.5">{log.details}</p>
                    </div>
                    <div className="text-right text-gray-500 font-mono">
                      <div>IP: {log.ipAddress}</div>
                      <div>{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Mainlayout>
  );
}
