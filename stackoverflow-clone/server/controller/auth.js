import mongoose from "mongoose";
import user from "../models/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import OTP from "../models/otp.js";
import Session from "../models/session.js";
import SecurityLog from "../models/securityLog.js";
import ReputationLog from "../models/reputationLog.js";
import { adjustReputation, REPUTATION_PRIVILEGES } from "../services/reputation.js";


export const Signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exisitinguser = await user.findOne({ email });
    if (exisitinguser) {
      return res.status(404).json({ message: "User already exist" });
    }

    const hashpassword = await bcrypt.hash(password, 12);
    const newuser = await user.create({
      name,
      email,
      password: hashpassword,
      plan: "free",
      subscriptionStatus: "none",
    });

    const token = jwt.sign(
      { email: newuser.email, id: newuser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const userResponse = newuser.toObject();
    delete userResponse.password;

    res.status(200).json({ data: userResponse, token });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json("something went wrong..");
    return;
  }
};

export const Login = async (req, res) => {
  const { email, password, deviceFingerprint, browser, os, deviceType } = req.body;
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "Unknown User-Agent";

  try {
    const exisitinguser = await user.findOne({ email });
    if (!exisitinguser) {
      await SecurityLog.create({
        email,
        event: "login_failed",
        ipAddress,
        userAgent,
        details: "User does not exist",
      });
      return res.status(404).json({ message: "User does not exist" });
    }

    if (exisitinguser.isSuspended) {
      return res.status(403).json({ message: "Account suspended by administrator" });
    }

    const ispasswordcrct = await bcrypt.compare(
      password,
      exisitinguser.password
    );
    if (!ispasswordcrct) {
      await SecurityLog.create({
        user: exisitinguser._id,
        email,
        event: "login_failed",
        ipAddress,
        userAgent,
        details: "Invalid password",
      });
      return res.status(400).json({ message: "Invalid password" });
    }

    const fp = deviceFingerprint || crypto.createHash("md5").update(userAgent + ipAddress).digest("hex");

    // Device Recognition: check if user has trusted session with this fingerprint
    const existingTrustedSession = await Session.findOne({
      user: exisitinguser._id,
      deviceFingerprint: fp,
      isTrusted: true,
      isRevoked: false,
    });

    if (!existingTrustedSession) {
      // Unrecognized / New Device -> Require Device Verification OTP
      const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(rawOtp, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await OTP.deleteMany({ user: exisitinguser._id, targetLanguage: "device_trust" });
      await OTP.create({
        user: exisitinguser._id,
        targetLanguage: "device_trust",
        type: "email",
        destination: exisitinguser.email,
        otpHash,
        expiresAt,
      });

      await SecurityLog.create({
        user: exisitinguser._id,
        email,
        event: "new_device_detected",
        ipAddress,
        userAgent,
        details: `New device login attempt detected (${browser || "Browser"} / ${os || "OS"})`,
      });

      const isEmailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

      return res.status(200).json({
        requiresDeviceOtp: true,
        userId: exisitinguser._id,
        message: "New device detected. OTP verification required to trust this device.",
        deviceFingerprint: fp,
        browser: browser || "Browser",
        os: os || "OS",
        deviceType: deviceType || "desktop",
        demoOtp: !isEmailConfigured ? rawOtp : undefined,
      });
    }

    // Existing Trusted Device -> Issue session
    const sessionId = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h session timeout

    const newSession = await Session.create({
      sessionId,
      user: exisitinguser._id,
      deviceFingerprint: fp,
      browser: browser || "Browser",
      os: os || "OS",
      deviceType: deviceType || "desktop",
      ipAddress,
      location: "Local/Remote IP",
      isTrusted: true,
      expiresAt,
    });

    await SecurityLog.create({
      user: exisitinguser._id,
      email,
      event: "login_success",
      ipAddress,
      userAgent,
      details: `Successful login on trusted device (${browser || "Browser"} on ${os || "OS"})`,
    });

    const token = jwt.sign(
      { email: exisitinguser.email, id: exisitinguser._id, sid: sessionId },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    const userResponse = exisitinguser.toObject();
    delete userResponse.password;

    res.status(200).json({ data: userResponse, token, sessionId });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json("something went wrong..");
    return;
  }
};

export const forgotPassword = async (req, res) => {
  const { identifier, phone } = req.body;
  const searchKey = identifier || phone;
  if (!searchKey) {
    return res.status(400).json({ message: "Email or phone number is required" });
  }

  try {
    const foundUser = await user.findOne({
      $or: [{ email: searchKey }, { phone: searchKey }],
    });

    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Rate limit check: only 1 reset request per user per day
    const todayStr = new Date().toISOString().split("T")[0];
    const lastResetStr = foundUser.lastPasswordResetDate
      ? new Date(foundUser.lastPasswordResetDate).toISOString().split("T")[0]
      : null;

    if (lastResetStr === todayStr) {
      return res
        .status(429)
        .json({ message: "You can use this option only one time per day." });
    }

    // Generate a temporary 6-digit verification code / token
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = jwt.sign(
      { id: foundUser._id, code: resetCode, purpose: "password_reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.status(200).json({
      message: "Verification code generated successfully",
      resetToken,
      // Demo verification code return so frontend verification works without external SMS/Email gateway
      verificationCode: resetCode,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "something went wrong.." });
  }
};

export const resetPassword = async (req, res) => {
  const { resetToken, verificationCode, newPassword } = req.body;

  if (!resetToken || !verificationCode || !newPassword) {
    return res
      .status(400)
      .json({ message: "Reset token, verification code, and new password are required" });
  }

  // Validate new password format: uppercase and lowercase English letters only
  if (!/^[a-zA-Z]+$/.test(newPassword)) {
    return res.status(400).json({
      message: "Password must contain uppercase and lowercase English letters only",
    });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "Invalid or expired reset token" });
    }

    if (decoded.purpose !== "password_reset" || decoded.code !== verificationCode) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    const foundUser = await user.findById(decoded.id);
    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Re-verify rate limit server-side
    const todayStr = new Date().toISOString().split("T")[0];
    const lastResetStr = foundUser.lastPasswordResetDate
      ? new Date(foundUser.lastPasswordResetDate).toISOString().split("T")[0]
      : null;

    if (lastResetStr === todayStr) {
      return res
        .status(429)
        .json({ message: "You can use this option only one time per day." });
    }

    const hashpassword = await bcrypt.hash(newPassword, 12);
    foundUser.password = hashpassword;
    foundUser.lastPasswordResetDate = new Date();
    await foundUser.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "something went wrong.." });
  }
};

export const getallusers = async (req, res) => {
  try {
    const alluser = await user.find().select("-password");
    res.status(200).json({ data: alluser });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json("something went wrong..");
    return;
  }
};

export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { name, about, tags, phone } = req.body.editForm || {};
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "User unavailable" });
  }
  try {
    const updateObj = { name, about, tags };
    if (phone !== undefined) {
      updateObj.phone = phone;
    }

    const updatedUser = await user.findByIdAndUpdate(
      _id,
      { $set: updateObj },
      { new: true }
    ).select("-password");


    if (updatedUser && !updatedUser.profileBonusAwarded) {
      const isComplete = updatedUser.name && updatedUser.about && updatedUser.about.trim().length > 0 && updatedUser.tags && updatedUser.tags.length > 0;
      if (isComplete) {
        updatedUser.profileBonusAwarded = true;
        await updatedUser.save();
        await adjustReputation(
          updatedUser._id,
          10,
          "profile_bonus",
          "Completed user profile with name, about, and tags",
          `profile_bonus_${updatedUser._id}`
        );
      }
    }

    res.status(200).json({ data: updatedUser });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};


export const requestLanguageOtp = async (req, res) => {
  const { targetLanguage } = req.body;
  const userId = req.userid;
  const currentUser = req.currentUser;

  const validLangs = ["en", "es", "hi", "pt", "zh", "fr"];
  if (!targetLanguage || !validLangs.includes(targetLanguage)) {
    return res.status(400).json({ message: "Invalid target language" });
  }

  // Requirement: French requires email OTP; Spanish, Hindi, Portuguese, Chinese requires mobile OTP
  const isEmailOtp = targetLanguage === "fr";
  const otpType = isEmailOtp ? "email" : "mobile";
  const destination = isEmailOtp ? currentUser.email : currentUser.phone;

  if (!destination) {
    return res.status(400).json({
      message: isEmailOtp
        ? "No registered email address found for verification."
        : "No registered phone number found for verification. Please update your profile first.",
    });
  }

  // Check resend cooldown / rate limit (e.g. max 1 request per 30 seconds)
  const existingOtp = await OTP.findOne({ user: userId, targetLanguage });
  if (existingOtp && Date.now() - existingOtp.createdAt.getTime() < 30000) {
    return res.status(429).json({ message: "Please wait 30 seconds before requesting a new OTP." });
  }

  const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(rawOtp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

  await OTP.deleteMany({ user: userId, targetLanguage });
  await OTP.create({
    user: userId,
    targetLanguage,
    type: otpType,
    destination,
    otpHash,
    expiresAt,
  });

  // Check environment providers
  const isEmailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  const isSmsConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const isProviderConfigured = isEmailOtp ? isEmailConfigured : isSmsConfigured;

  let demoNote = undefined;
  if (!isProviderConfigured) {
    demoNote = `Gateway provider not configured in environment. Demo OTP code: ${rawOtp}`;
  }

  res.status(200).json({
    message: `OTP generated for ${otpType} verification (${destination}).`,
    otpType,
    destination,
    providerConfigured: isProviderConfigured,
    demoOtp: demoNote ? rawOtp : undefined,
  });
};

export const verifyLanguageOtp = async (req, res) => {
  const { targetLanguage, otp } = req.body;
  const userId = req.userid;

  if (!targetLanguage || !otp) {
    return res.status(400).json({ message: "Target language and OTP code are required" });
  }

  try {
    const otpRecord = await OTP.findOne({ user: userId, targetLanguage });
    if (!otpRecord) {
      return res.status(400).json({ message: "No active OTP request found. Please request a new OTP." });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ message: "Maximum verification attempts exceeded. Request a new OTP." });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isValid) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: "Invalid OTP code. Please check and try again." });
    }

    // Update user preferred language
    await user.findByIdAndUpdate(userId, { preferredLanguage: targetLanguage });
    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({
      message: "Language switch verified and updated successfully!",
      preferredLanguage: targetLanguage,
    });
  } catch (error) {
    console.error("Verify language OTP error:", error);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
};

export const verifyDeviceOtp = async (req, res) => {
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "Unknown User-Agent";

  if (!userId || !otp) {
    return res.status(400).json({ message: "User ID and OTP are required" });
  }

  try {
    const foundUser = await user.findById(userId);
    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const otpRecord = await OTP.findOne({ user: userId, targetLanguage: "device_trust" });
    if (!otpRecord) {
      return res.status(400).json({ message: "No active device OTP request found." });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: "OTP has expired. Please log in again." });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ message: "Maximum verification attempts exceeded." });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isValid) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: "Invalid OTP code." });
    }

    await OTP.deleteOne({ _id: otpRecord._id });

    // Issue new trusted session
    const sessionId = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fp = deviceFingerprint || crypto.createHash("md5").update(userAgent + ipAddress).digest("hex");

    await Session.create({
      sessionId,
      user: foundUser._id,
      deviceFingerprint: fp,
      browser: browser || "Browser",
      os: os || "OS",
      deviceType: deviceType || "desktop",
      ipAddress,
      location: "Verified Device Location",
      isTrusted: markTrusted !== false,
      expiresAt,
    });

    await SecurityLog.create({
      user: foundUser._id,
      email: foundUser.email,
      event: "new_device_verified",
      ipAddress,
      userAgent,
      details: `New device verified & trusted (${browser || "Browser"} / ${os || "OS"})`,
    });

    const token = jwt.sign(
      { email: foundUser.email, id: foundUser._id, sid: sessionId },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    const userResponse = foundUser.toObject();
    delete userResponse.password;

    res.status(200).json({ data: userResponse, token, sessionId });
  } catch (error) {
    console.error("Verify device OTP error:", error);
    res.status(500).json({ message: "Failed to verify device OTP" });
  }
};

export const getMySessions = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.userid, isRevoked: false }).sort({ lastActive: -1 });
    res.status(200).json(sessions);
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ message: "Failed to fetch active sessions" });
  }
};

export const revokeSession = async (req, res) => {
  const { sessionId } = req.params;
  try {
    const sessionToRevoke = await Session.findOne({ sessionId });
    if (!sessionToRevoke) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (String(sessionToRevoke.user) !== String(req.userid)) {
      return res.status(403).json({ message: "Not authorized to revoke this session" });
    }

    sessionToRevoke.isRevoked = true;
    await sessionToRevoke.save();

    await SecurityLog.create({
      user: req.userid,
      event: "session_revoked",
      details: `Session ${sessionId} revoked by user`,
    });

    res.status(200).json({ message: "Session revoked successfully" });
  } catch (error) {
    console.error("Revoke session error:", error);
    res.status(500).json({ message: "Failed to revoke session" });
  }
};

export const revokeOtherSessions = async (req, res) => {
  try {
    const currentSid = req.sessionId;
    await Session.updateMany(
      { user: req.userid, sessionId: { $ne: currentSid } },
      { isRevoked: true }
    );

    await SecurityLog.create({
      user: req.userid,
      event: "revoke_other_sessions",
      details: "All other active sessions revoked by user",
    });

    res.status(200).json({ message: "All other active sessions revoked successfully" });
  } catch (error) {
    console.error("Revoke other sessions error:", error);
    res.status(500).json({ message: "Failed to revoke other sessions" });
  }
};

export const getSecurityLogs = async (req, res) => {
  try {
    const isUserAdmin = req.currentUser.role === "admin";
    const query = isUserAdmin ? {} : { user: req.userid };

    const logs = await SecurityLog.find(query).sort({ createdAt: -1 }).limit(50);
    res.status(200).json(logs);
  } catch (error) {
    console.error("Get security logs error:", error);
    res.status(500).json({ message: "Failed to fetch security logs" });
  }
};

// Reputation Endpoints
export const transferReputation = async (req, res) => {
  const { recipientId, amount, reason } = req.body;
  const senderId = req.userid;
  const numAmount = Number(amount);

  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    return res.status(400).json({ message: "Invalid recipient ID" });
  }
  if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ message: "Transfer amount must be greater than zero" });
  }
  if (numAmount > 50) {
    return res.status(400).json({ message: "Maximum 50 reputation per individual transfer" });
  }
  if (String(senderId) === String(recipientId)) {
    return res.status(400).json({ message: "Cannot transfer reputation to yourself" });
  }

  try {
    const sender = await user.findById(senderId);
    const recipient = await user.findById(recipientId);

    if (!sender || !recipient) {
      return res.status(404).json({ message: "Sender or recipient user not found" });
    }

    if ((sender.reputation || 0) <= 50) {
      return res.status(403).json({ message: "Only users with more than 50 reputation may transfer reputation" });
    }

    if ((sender.reputation || 0) < numAmount) {
      return res.status(400).json({ message: "Cannot transfer more reputation than you currently own" });
    }

    // Reset daily transferred counter if new day
    const todayStr = new Date().toISOString().split("T")[0];
    const lastTransferStr = sender.lastTransferDate
      ? new Date(sender.lastTransferDate).toISOString().split("T")[0]
      : null;

    let currentDailyTransferred = sender.dailyReputationTransferred || 0;
    if (lastTransferStr !== todayStr) {
      currentDailyTransferred = 0;
    }

    if (currentDailyTransferred + numAmount > 100) {
      return res.status(400).json({
        message: `Daily transfer limit of 100 reputation reached. You can transfer up to ${Math.max(0, 100 - currentDailyTransferred)} more today.`,
      });
    }

    // Update sender balance and daily metrics atomically
    sender.reputation -= numAmount;
    sender.dailyReputationTransferred = currentDailyTransferred + numAmount;
    sender.lastTransferDate = new Date();
    await sender.save();

    // Update recipient balance atomically
    recipient.reputation = (recipient.reputation || 0) + numAmount;
    await recipient.save();

    const transferId = new mongoose.Types.ObjectId().toString();

    // Log sender transaction
    await ReputationLog.create({
      user: sender._id,
      amount: -numAmount,
      reason: "transfer_sent",
      details: `Transferred ${numAmount} reputation to ${recipient.name}. Reason: ${reason || "None"}`,
      relatedId: transferId,
      resultingBalance: sender.reputation,
    });

    // Log recipient transaction
    await ReputationLog.create({
      user: recipient._id,
      amount: numAmount,
      reason: "transfer_received",
      details: `Received ${numAmount} reputation from ${sender.name}. Reason: ${reason || "None"}`,
      relatedId: transferId,
      resultingBalance: recipient.reputation,
    });

    res.status(200).json({
      message: `Successfully transferred ${numAmount} reputation to ${recipient.name}`,
      senderReputation: sender.reputation,
    });
  } catch (error) {
    console.error("Transfer reputation error:", error);
    res.status(500).json({ message: "Failed to transfer reputation" });
  }
};

export const getReputationHistory = async (req, res) => {
  const { userId } = req.params;
  const targetId = userId || req.userid;

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const history = await ReputationLog.find({ user: targetId }).sort({ createdAt: -1 }).limit(100);
    res.status(200).json(history);
  } catch (error) {
    console.error("Get reputation history error:", error);
    res.status(500).json({ message: "Failed to fetch reputation history" });
  }
};

export const getPrivileges = async (req, res) => {
  try {
    const currentUser = await user.findById(req.userid);
    const rep = currentUser ? currentUser.reputation || 0 : 0;

    const privileges = REPUTATION_PRIVILEGES.map((p) => ({
      ...p,
      unlocked: rep >= p.min,
    }));

    res.status(200).json({
      reputation: rep,
      privileges,
    });
  } catch (error) {
    console.error("Get privileges error:", error);
    res.status(500).json({ message: "Failed to fetch privileges" });
  }
};
