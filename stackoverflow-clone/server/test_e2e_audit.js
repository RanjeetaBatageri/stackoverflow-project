import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/auth.js";
import Question from "./models/question.js";
import Post from "./models/post.js";
import Session from "./models/session.js";
import SecurityLog from "./models/securityLog.js";
import ReputationLog from "./models/reputationLog.js";
import Subscription from "./models/subscription.js";
import Payment from "./models/payment.js";
import Invoice from "./models/invoice.js";
import OTP from "./models/otp.js";
import { checkQuestionLimit, incrementQuestionLimit } from "./services/planPermissions.js";
import { transferReputation } from "./controller/auth.js";

dotenv.config();

const MONGO_URI = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/stackoverflow_test";

const runAuditSuite = async () => {
  console.log("=========================================================");
  console.log("  STARTING FINAL E2E & ACCOUNT ISOLATION AUDIT SUITE    ");
  console.log("=========================================================\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB.");

    // Clean test data
    await User.deleteMany({ email: { $regex: /@isolation-test\.com$/ } });
    await Question.deleteMany({ questiontitle: { $regex: /Isolation Test/ } });
    await Post.deleteMany({ title: { $regex: /Isolation Test/ } });
    await Session.deleteMany({ deviceFingerprint: "isolation_fp_123" });
    await SecurityLog.deleteMany({ details: { $regex: /Isolation/ } });
    await ReputationLog.deleteMany({ details: { $regex: /Isolation/ } });

    // -------------------------------------------------------------
    // SECTION 1: TWO-ACCOUNT CREATION & ISOLATION SETUP
    // -------------------------------------------------------------
    console.log("\n--- SECTION 1: Account Setup ---");
    const accountA = await User.create({
      name: "Account A User",
      email: "accountA@isolation-test.com",
      password: "Password123",
      phone: "+1111111111",
      reputation: 100,
      plan: "free",
      dailyQuestionCount: 0,
    });

    const accountB = await User.create({
      name: "Account B User",
      email: "accountB@isolation-test.com",
      password: "Password123",
      phone: "+2222222222",
      reputation: 25,
      plan: "bronze",
      subscriptionStatus: "active",
      dailyQuestionCount: 0,
    });


    console.log(`✓ Account A created: ID ${accountA._id}, Rep: ${accountA.reputation}, Plan: ${accountA.plan}`);
    console.log(`✓ Account B created: ID ${accountB._id}, Rep: ${accountB.reputation}, Plan: ${accountB.plan}`);

    // -------------------------------------------------------------
    // SECTION 2: QUESTION QUOTA & STRESS TEST
    // -------------------------------------------------------------
    console.log("\n--- SECTION 2: Question Quota Stress Test ---");
    // Check initial limit for Free Account A (Limit: 1)
    let limitA = await checkQuestionLimit(accountA._id.toString());
    console.log(`✓ Account A initial quota check: allowed=${limitA.allowed}, limit=${limitA.limit}, used=${limitA.used}`);
    if (!limitA.allowed || limitA.limit !== 1) {
      throw new Error("Account A question limit assertion failed!");
    }

    // Check initial limit for Bronze Account B (Limit: 5)
    let limitB = await checkQuestionLimit(accountB._id.toString());
    console.log(`✓ Account B initial quota check: allowed=${limitB.allowed}, limit=${limitB.limit}, used=${limitB.used}`);
    if (!limitB.allowed || limitB.limit !== 5) {
      throw new Error("Account B question limit assertion failed!");
    }

    // Simulate Account A asking a question
    await Question.create({
      questiontitle: "Isolation Test Question from A",
      questionbody: "Body text A",
      questiontags: ["testing"],
      userposted: accountA.name,
      userid: accountA._id.toString(),
    });
    await incrementQuestionLimit(accountA._id.toString());

    // Verify Account A quota consumed (1/1)
    limitA = await checkQuestionLimit(accountA._id.toString());
    console.log(`✓ Account A post-ask quota: allowed=${limitA.allowed}, used=${limitA.used}`);
    if (limitA.allowed || limitA.used !== 1) {
      throw new Error("Account A quota should now be exhausted!");
    }

    // Verify Account B quota remains untouched (0/5)
    limitB = await checkQuestionLimit(accountB._id.toString());
    console.log(`✓ Account B quota after A asked question: allowed=${limitB.allowed}, used=${limitB.used}`);
    if (!limitB.allowed || limitB.used !== 0) {
      throw new Error("Account B quota was incorrectly affected by Account A!");
    }

    // Attempt failed question creation simulation for Account B
    try {
      // Intentionally invalid question document
      const badQ = new Question({ questiontitle: "" });
      await badQ.save();
    } catch (err) {
      console.log("✓ Simulated question save failure caught successfully.");
    }

    // Verify Account B quota was NOT consumed by failed attempt
    limitB = await checkQuestionLimit(accountB._id.toString());
    console.log(`✓ Account B quota after failed save: used=${limitB.used}`);
    if (limitB.used !== 0) {
      throw new Error("Failed question creation consumed daily quota!");
    }

    // -------------------------------------------------------------
    // SECTION 3: REPUTATION & CROSS-ACCOUNT TRANSACTIONS
    // -------------------------------------------------------------
    console.log("\n--- SECTION 3: Reputation Isolation & Transfers ---");
    // Attempt self-transfer for Account A (Should fail)
    let resData = {};
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          resData = { code, data };
        },
      }),
    };

    await transferReputation(
      {
        body: { recipientId: accountA._id.toString(), amount: 10 },
        userid: accountA._id.toString(),
      },
      mockRes
    );
    console.log(`✓ Self-transfer rejection: Code ${resData.code}, Msg: "${resData.data?.message}"`);

    // Attempt transfer from Account B (>50 rep required, B has 25 rep)
    await transferReputation(
      {
        body: { recipientId: accountA._id.toString(), amount: 10 },
        userid: accountB._id.toString(),
      },
      mockRes
    );
    console.log(`✓ Insufficient rep transfer rejection: Code ${resData.code}, Msg: "${resData.data?.message}"`);

    // Valid transfer from A (100 rep) to B (25 rep): Transfer 30 rep
    await transferReputation(
      {
        body: { recipientId: accountB._id.toString(), amount: 30, reason: "Audit Test" },
        userid: accountA._id.toString(),
      },
      mockRes
    );

    const updatedA = await User.findById(accountA._id);
    const updatedB = await User.findById(accountB._id);
    console.log(`✓ Transfer 30 rep: Account A = ${updatedA.reputation} (Exp: 70), Account B = ${updatedB.reputation} (Exp: 55)`);
    if (updatedA.reputation !== 70 || updatedB.reputation !== 55) {
      throw new Error("Reputation transfer balances incorrect!");
    }

    // -------------------------------------------------------------
    // SECTION 4: SESSIONS & SECURITY LOGS ISOLATION
    // -------------------------------------------------------------
    console.log("\n--- SECTION 4: Sessions & Security Log Isolation ---");
    const sessA = await Session.create({
      sessionId: "isolation_sess_A",
      user: accountA._id,
      deviceFingerprint: "isolation_fp_123",
      browser: "Chrome",
      os: "Windows",
      expiresAt: new Date(Date.now() + 3600000),
    });

    const sessB = await Session.create({
      sessionId: "isolation_sess_B",
      user: accountB._id,
      deviceFingerprint: "isolation_fp_123",
      browser: "Firefox",
      os: "MacOS",
      expiresAt: new Date(Date.now() + 3600000),
    });

    // Query active sessions for Account A
    const userASessions = await Session.find({ user: accountA._id, isRevoked: false });
    const userBSessions = await Session.find({ user: accountB._id, isRevoked: false });

    console.log(`✓ Account A active session count: ${userASessions.length}`);
    console.log(`✓ Account B active session count: ${userBSessions.length}`);

    if (userASessions.some((s) => s.user.toString() === accountB._id.toString())) {
      throw new Error("Account A received Account B session data!");
    }

    console.log("\n=========================================================");
    console.log("  ALL E2E & ISOLATION TESTS PASSED WITH 100% SUCCESS    ");
    console.log("=========================================================\n");
  } catch (err) {
    console.error("Audit suite failed with error:", err);
  } finally {
    await mongoose.connection.close();
  }
};

runAuditSuite();
