import jwt from "jsonwebtoken";
import User from "../models/auth.js";
import Session from "../models/session.js";

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    let decodedata = jwt.verify(token, process.env.JWT_SECRET);
    req.userid = decodedata?.id;
    req.sessionId = decodedata?.sid;

    // Validate session status in DB if session ID is present
    if (decodedata?.sid) {
      const activeSession = await Session.findOne({ sessionId: decodedata.sid });
      if (!activeSession || activeSession.isRevoked) {
        return res.status(401).json({ message: "Session has been revoked or expired" });
      }
      if (new Date() > activeSession.expiresAt) {
        activeSession.isRevoked = true;
        await activeSession.save();
        return res.status(401).json({ message: "Session timeout due to inactivity" });
      }

      // Update last active timestamp
      activeSession.lastActive = new Date();
      await activeSession.save();
      req.currentSession = activeSession;
    }

    const currentUser = await User.findById(req.userid);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }
    if (currentUser.isSuspended) {
      return res.status(403).json({ message: "Account suspended by administrator" });
    }
    req.currentUser = currentUser;
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const adminOnly = async (req, res, next) => {
  if (!req.currentUser || req.currentUser.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export const requireReputation = (requiredRep) => {
  return (req, res, next) => {
    const userRep = req.currentUser?.reputation || 0;
    if (userRep < requiredRep) {
      return res.status(403).json({
        message: `Insufficient reputation. You need at least ${requiredRep} reputation points for this action. (Current: ${userRep})`,
      });
    }
    next();
  };
};

export default auth;
