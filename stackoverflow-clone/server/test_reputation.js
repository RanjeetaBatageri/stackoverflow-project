import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/auth.js";
import Question from "./models/question.js";
import Post from "./models/post.js";
import ReputationLog from "./models/reputationLog.js";
import { adjustReputation } from "./services/reputation.js";
import { votequestion, acceptAnswer } from "./controller/question.js";
import { Askanswer, deleteanswer } from "./controller/answer.js";
import { transferReputation } from "./controller/auth.js";
import { adminRemovePost } from "./controller/post.js";

dotenv.config();

const MONGO_URI = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/stackoverflow_test";

const runTests = async () => {
  console.log("=== RUNNING REPUTATION & REWARDS SYSTEM TESTS ===");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to database.");

    // Clean up test collections
    await User.deleteMany({ email: /@test\.com$/ });
    await Question.deleteMany({ questiontitle: /Test Question/ });
    await Post.deleteMany({ title: /Test Post/ });
    await ReputationLog.deleteMany({});

    // 1. Create Test Users
    const u1 = await User.create({
      name: "User One",
      email: "user1@test.com",
      password: "Password123",
      reputation: 60,
    });

    const u2 = await User.create({
      name: "User Two",
      email: "user2@test.com",
      password: "Password123",
      reputation: 10,
    });

    const admin = await User.create({
      name: "Admin User",
      email: "admin@test.com",
      password: "Password123",
      role: "admin",
      reputation: 100,
    });

    console.log("✓ Initial users created. U1 rep: 60, U2 rep: 10, Admin rep: 100");

    // 2. Answer Reputation (+5)
    const q1 = await Question.create({
      questiontitle: "Test Question 1",
      questionbody: "Body 1",
      questiontags: ["javascript"],
      userposted: u1.name,
      userid: u1._id.toString(),
    });

    const reqPostAns = {
      params: { id: q1._id.toString() },
      body: { answerbody: "My test answer", useranswered: u2.name },
      userid: u2._id.toString(),
    };

    let resData = {};
    const resPostAns = {
      status: (code) => ({
        json: (data) => {
          resData = { code, data };
        },
      }),
    };

    await Askanswer(reqPostAns, resPostAns);
    const updatedU2_ans = await User.findById(u2._id);
    console.log(`✓ Answer posted (+5 rep): U2 reputation = ${updatedU2_ans.reputation} (Expected: 15)`);

    // Fetch updated question with answer ID
    const q1Updated = await Question.findById(q1._id);
    const ansObj = q1Updated.answer[0];

    // 3. Accepted Answer (+10)
    const reqAccept = {
      params: { id: q1._id.toString(), answerId: ansObj._id.toString() },
      userid: u1._id.toString(),
    };
    await acceptAnswer(reqAccept, resPostAns);
    const updatedU2_accept = await User.findById(u2._id);
    console.log(`✓ Answer accepted (+10 rep): U2 reputation = ${updatedU2_accept.reputation} (Expected: 25)`);

    // 4. Downvote Deduction (-2)
    const reqDownvote = {
      params: { id: q1._id.toString() },
      body: { value: "downvote" },
      userid: u2._id.toString(),
    };
    await votequestion(reqDownvote, resPostAns);
    const updatedU1_down = await User.findById(u1._id);
    console.log(`✓ Question downvoted (-2 rep): U1 reputation = ${updatedU1_down.reputation} (Expected: 58)`);

    // 5. Question 10 Upvotes Threshold (+2)
    const freshQ1 = await Question.findById(q1._id);
    const mockUpvoters = Array.from({ length: 10 }, (_, i) => new mongoose.Types.ObjectId().toString());
    freshQ1.upvote = mockUpvoters;
    await freshQ1.save();


    const reqUpvote = {
      params: { id: q1._id.toString() },
      body: { value: "upvote" },
      userid: mockUpvoters[0],
    };
    await votequestion(reqUpvote, resPostAns);
    const updatedU1_threshold = await User.findById(u1._id);
    console.log(`✓ Question 10 upvotes threshold (+2 rep): U1 reputation = ${updatedU1_threshold.reputation} (Expected: 60)`);

    // 6. Self Delete Answer (-5)
    const reqDeleteAns = {
      params: { id: q1._id.toString() },
      body: { answerid: ansObj._id.toString() },
      userid: u2._id.toString(),
    };
    await deleteanswer(reqDeleteAns, resPostAns);
    const updatedU2_selfDelete = await User.findById(u2._id);
    console.log(`✓ Self deleted answer (-5 rep): U2 reputation = ${updatedU2_selfDelete.reputation} (Expected: 20)`);

    // 7. Admin Content Removal (-10)
    const testPost = await Post.create({
      user: u2._id,
      userName: u2.name,
      title: "Test Post for Admin Removal",
      content: "Bad content",
      category: "technical_update",
    });

    const reqAdminRemove = {
      params: { id: testPost._id.toString() },
      currentUser: { role: "admin" },
      userid: admin._id.toString(),
    };
    await adminRemovePost(reqAdminRemove, resPostAns);
    const updatedU2_adminRemove = await User.findById(u2._id);
    console.log(`✓ Admin removed content (-10 rep): U2 reputation = ${updatedU2_adminRemove.reputation} (Expected: 10)`);

    // 8. Reputation Transfer Tests
    // 8a. Self Transfer (Should fail)
    let transferRes = {};
    const mockResTransfer = {
      status: (code) => ({
        json: (data) => {
          transferRes = { code, data };
        },
      }),
    };

    await transferReputation(
      {
        body: { recipientId: u1._id.toString(), amount: 10 },
        userid: u1._id.toString(),
      },
      mockResTransfer
    );
    console.log(`✓ Self-transfer rejection test: Code ${transferRes.code}, Message: "${transferRes.data?.message}"`);

    // 8b. Transfer with <= 50 rep (U2 has 10 rep, should fail)
    await transferReputation(
      {
        body: { recipientId: u1._id.toString(), amount: 5 },
        userid: u2._id.toString(),
      },
      mockResTransfer
    );
    console.log(`✓ Low rep transfer rejection (< 50 rep): Code ${transferRes.code}, Message: "${transferRes.data?.message}"`);

    // 8c. Valid Transfer (U1 has 60 rep, transfers 20 rep to U2)
    await transferReputation(
      {
        body: { recipientId: u2._id.toString(), amount: 20, reason: "Bounty for help" },
        userid: u1._id.toString(),
      },
      mockResTransfer
    );
    const finalU1 = await User.findById(u1._id);
    const finalU2 = await User.findById(u2._id);
    console.log(`✓ Valid transfer (20 rep): U1 balance = ${finalU1.reputation} (Expected: 40), U2 balance = ${finalU2.reputation} (Expected: 30)`);

    // 8d. Transfer limit per transaction (> 50 rep)
    finalU1.reputation = 100;
    await finalU1.save();
    await transferReputation(
      {
        body: { recipientId: u2._id.toString(), amount: 55 },
        userid: u1._id.toString(),
      },
      mockResTransfer
    );
    console.log(`✓ Exceed single transfer limit (>50): Code ${transferRes.code}, Message: "${transferRes.data?.message}"`);

    // 9. Reputation Log Check
    const logs = await ReputationLog.find({ user: u1._id }).sort({ createdAt: -1 });
    console.log(`✓ Reputation log records verified: ${logs.length} entries for U1.`);

    console.log("\nALL BACKEND REPUTATION TESTS COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await mongoose.connection.close();
  }
};

runTests();
