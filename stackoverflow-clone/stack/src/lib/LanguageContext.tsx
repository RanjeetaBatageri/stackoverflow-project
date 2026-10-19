import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SupportedLanguage, LANGUAGES, translations } from "./translations";
import { useAuth } from "./AuthContext";
import axiosInstance from "./axiosinstance";
import { toast } from "react-toastify";

interface LanguageContextProps {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
  requestLangSwitch: (targetLang: SupportedLanguage) => Promise<boolean>;
  verifyLangOtp: (targetLang: SupportedLanguage, otp: string) => Promise<boolean>;
  pendingLang: SupportedLanguage | null;
  otpModalOpen: boolean;
  setOtpModalOpen: (open: boolean) => void;
  otpInfo: { destination?: string; type?: string; demoOtp?: string } | null;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { user, updateUserState } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>("en");
  const [pendingLang, setPendingLang] = useState<SupportedLanguage | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpInfo, setOtpInfo] = useState<{ destination?: string; type?: string; demoOtp?: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("preferred_lang") as SupportedLanguage;
      if (stored && translations[stored]) {
        setLanguageState(stored);
      } else if (user?.preferredLanguage && translations[user.preferredLanguage as SupportedLanguage]) {
        setLanguageState(user.preferredLanguage as SupportedLanguage);
      }
    }
  }, [user?.preferredLanguage]);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_lang", lang);
    }
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations["en"]?.[key] || key;
  };

  const requestLangSwitch = async (targetLang: SupportedLanguage): Promise<boolean> => {
    if (targetLang === language) return false;

    // Direct switch if user not logged in for client preview, or prompt OTP requirement
    if (!user) {
      setLanguage(targetLang);
      toast.success(`Language updated to ${LANGUAGES.find((l) => l.code === targetLang)?.name}`);
      return true;
    }

    try {
      const res = await axiosInstance.post("/user/request-language-otp", {
        targetLanguage: targetLang,
      });

      setPendingLang(targetLang);
      setOtpInfo({
        destination: res.data.destination,
        type: res.data.otpType,
        demoOtp: res.data.demoOtp,
      });
      setOtpModalOpen(true);
      toast.info(res.data.message);
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to initiate language switch OTP");
      return false;
    }
  };

  const verifyLangOtp = async (targetLang: SupportedLanguage, otp: string): Promise<boolean> => {
    try {
      const res = await axiosInstance.post("/user/verify-language-otp", {
        targetLanguage: targetLang,
        otp: otp.trim(),
      });

      setLanguage(targetLang);
      updateUserState({ preferredLanguage: targetLang });
      setOtpModalOpen(false);
      setPendingLang(null);
      setOtpInfo(null);
      toast.success(res.data.message);
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "OTP verification failed");
      return false;
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        requestLangSwitch,
        verifyLangOtp,
        pendingLang,
        otpModalOpen,
        setOtpModalOpen,
        otpInfo,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
