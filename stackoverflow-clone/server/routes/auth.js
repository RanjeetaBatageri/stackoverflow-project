import express from "express";
import {
  getallusers,
  Login,
  Signup,
  updateprofile,
  forgotPassword,
  resetPassword,
  requestLanguageOtp,
  verifyLanguageOtp,
  verifyDeviceOtp,
  getMySessions,
  revokeSession,
  revokeOtherSessions,
  getSecurityLogs,
  transferReputation,
  getReputationHistory,
  getPrivileges,
} from "../controller/auth.js";

const router = express.Router();
import auth from "../middleware/auth.js";
router.post("/signup", Signup);
router.post("/login", Login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-device-otp", verifyDeviceOtp);
router.post("/request-language-otp", auth, requestLanguageOtp);
router.post("/verify-language-otp", auth, verifyLanguageOtp);
router.get("/sessions", auth, getMySessions);
router.delete("/sessions/other", auth, revokeOtherSessions);
router.delete("/sessions/:sessionId", auth, revokeSession);
router.get("/security-logs", auth, getSecurityLogs);
router.post("/reputation/transfer", auth, transferReputation);
router.get("/reputation/history", auth, getReputationHistory);
router.get("/reputation/history/:userId", auth, getReputationHistory);

router.get("/reputation/privileges", auth, getPrivileges);
router.get("/getalluser", getallusers);
router.patch("/update/:id", auth, updateprofile);
export default router;

