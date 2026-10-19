import React, { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { LANGUAGES, SupportedLanguage } from "@/lib/translations";
import { Globe } from "lucide-react";

export default function LanguageSelector() {
  const { language, requestLangSwitch, pendingLang, verifyLangOtp, otpModalOpen, setOtpModalOpen, otpInfo } = useLanguage();
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const target = e.target.value as SupportedLanguage;
    if (target === language) return;
    await requestLangSwitch(target);
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLang || !otpCode.trim()) return;
    setLoading(true);
    const success = await verifyLangOtp(pendingLang, otpCode);
    setLoading(false);
    if (success) {
      setOtpCode("");
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs">
        <Globe className="w-3.5 h-3.5 text-gray-600" />
        <select
          value={language}
          onChange={handleSelect}
          className="bg-transparent text-gray-800 font-medium focus:outline-none cursor-pointer"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* OTP Verification Modal */}
      {otpModalOpen && pendingLang && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              Language Switch Verification
            </h3>
            <p className="text-sm text-gray-600">
              {pendingLang === "fr"
                ? `Verification code sent to your registered email (${otpInfo?.destination}) for switching to French.`
                : `Verification code sent via SMS to your mobile (${otpInfo?.destination}) for switching to ${LANGUAGES.find((l) => l.code === pendingLang)?.name}.`}
            </p>

            {otpInfo?.demoOtp && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-mono">
                {otpInfo.demoOtp}
              </div>
            )}

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Enter 6-digit OTP code
                </label>
                <input
                  type="text"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm font-mono tracking-widest focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(false)}
                  className="px-4 py-2 border rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-medium"
                >
                  {loading ? "Verifying..." : "Verify & Switch Language"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
