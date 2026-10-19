import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "react-toastify";
import { RefreshCw, KeyRound, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [identifier, setIdentifier] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Helper password generator using uppercase and lowercase English letters only
  const generateLettersOnlyPassword = (length = 12) => {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return password;
  };

  const handleGeneratePassword = () => {
    const generated = generateLettersOnlyPassword(12);
    setNewPassword(generated);
    toast.info("Generated a secure password (letters only)");
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (!identifier.trim()) {
      toast.error("Email or phone number is required");
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post("/user/forgot-password", {
        identifier: identifier.trim(),
      });

      setResetToken(res.data.resetToken);
      if (res.data.verificationCode) {
        setVerificationCode(res.data.verificationCode);
      }
      toast.success(res.data.message || "Reset request initiated");
      setStep("reset");
    } catch (error: any) {
      const msg =
        error.response?.data?.message || "Failed to initiate reset request";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!verificationCode.trim()) {
      toast.error("Verification code is required");
      return;
    }

    if (!newPassword.trim()) {
      toast.error("New password is required");
      return;
    }

    // Client side validation: English letters only
    if (!/^[a-zA-Z]+$/.test(newPassword)) {
      const err =
        "Password must contain uppercase and lowercase English letters only";
      setErrorMessage(err);
      toast.error(err);
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post("/user/reset-password", {
        resetToken,
        verificationCode: verificationCode.trim(),
        newPassword: newPassword.trim(),
      });

      toast.success(res.data.message || "Password updated successfully");
      router.push("/auth");
    } catch (error: any) {
      const msg = error.response?.data?.message || "Failed to reset password";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 lg:mb-8">
          <Link href="/" className="flex items-center justify-center mb-4">
            <div className="w-6 h-6 lg:w-8 lg:h-8 bg-orange-500 rounded mr-2 flex items-center justify-center">
              <div className="w-4 h-4 lg:w-6 lg:h-6 bg-white rounded-sm flex items-center justify-center">
                <div className="w-3 h-3 lg:w-4 lg:h-4 bg-orange-500 rounded-sm"></div>
              </div>
            </div>
            <span className="text-lg lg:text-xl font-bold text-gray-800">
              stack<span className="font-normal">overflow</span>
            </span>
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl lg:text-2xl">
              Forgot Password
            </CardTitle>
            <CardDescription>
              {step === "request"
                ? "Enter your registered email address or phone number to reset your password"
                : "Verify your identity and set a new password"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md border border-red-200">
                {errorMessage}
              </div>
            )}

            {step === "request" ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-sm font-medium">
                    Registered Email or Phone Number
                  </Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="email@example.com or +1234567890"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm"
                >
                  {loading ? "Processing..." : "Request Password Reset"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verificationCode" className="text-sm font-medium">
                    Verification Code
                  </Label>
                  <Input
                    id="verificationCode"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="newPassword" className="text-sm font-medium">
                      New Password (Letters Only)
                    </Label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Generate Password
                    </button>
                  </div>
                  <Input
                    id="newPassword"
                    type="text"
                    placeholder="Enter letters-only password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500">
                    Must contain only uppercase and lowercase English letters (A-Z, a-z).
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  {loading ? "Updating..." : "Reset Password"}
                </Button>
              </form>
            )}

            <div className="text-center text-sm pt-2">
              <Link
                href="/auth"
                className="text-blue-600 hover:underline flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
