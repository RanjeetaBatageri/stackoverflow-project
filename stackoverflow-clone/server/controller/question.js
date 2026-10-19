import mongoose from "mongoose";
import question from "../models/question.js";
import {
  checkQuestionLimit,
  incrementQuestionLimit,
} from "../services/planPermissions.js";
import { adjustReputation } from "../services/reputation.js";

export const Askquestion = async (req, res) => {
  const { postquestiondata } = req.body;
  const userId = req.userid || postquestiondata?.userid;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required to ask questions" });
  }

  try {
    const limitCheck = await checkQuestionLimit(userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        message: limitCheck.message,
        limitExceeded: true,
        limit: limitCheck.limit,
        used: limitCheck.used,
        currentPlan: limitCheck.currentPlan,
        recommendedPlan: limitCheck.recommendedPlan,
      });
    }

    const postques = new question({ ...postquestiondata, userid: userId });
    await postques.save();

    await incrementQuestionLimit(userId);

    res.status(200).json({
      data: postques,
      usage: {
        ...limitCheck,
        used: limitCheck.used + 1,
        remaining:
          limitCheck.limit === -1
            ? "unlimited"
            : Math.max(0, limitCheck.limit - (limitCheck.used + 1)),
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};

export const getallquestion = async (req, res) => {
  try {
    const allquestion = await question.find().sort({ askedon: -1 });
    res.status(200).json({ data: allquestion });
  } catch (error) {
    res.status(500).json("something went wrong..");
    return;
  }
};

export const deletequestion = async (req, res) => {
  const { id: _id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "question unavailable" });
  }
  try {
    const ques = await question.findById(_id);
    if (!ques) {
      return res.status(404).json({ message: "question unavailable" });
    }

    const isOwner = String(ques.userid) === String(req.userid);
    const isAdmin = req.currentUser?.role === "admin";

    if (isAdmin && !isOwner) {
      // Reputation Rule: -10 when admin removes content
      await adjustReputation(
        ques.userid,
        -10,
        "admin_removal_deduction",
        `Admin removed question "${ques.questiontitle}"`,
        String(ques._id)
      );
    }

    await question.findByIdAndDelete(_id);
    res.status(200).json({ message: "question deleted" });
  } catch (error) {
    res.status(500).json("something went wrong..");
    return;
  }
};

export const votequestion = async (req, res) => {
  const { id: _id } = req.params;
  const { value, userid: bodyUserId } = req.body;
  const userid = req.userid || bodyUserId;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "question unavailable" });
  }
  try {
    const questionDoc = await question.findById(_id);
    if (!questionDoc) {
      return res.status(404).json({ message: "question unavailable" });
    }

    const upindex = questionDoc.upvote.findIndex((id) => id === String(userid));
    const downindex = questionDoc.downvote.findIndex(
      (id) => id === String(userid)
    );

    let isNewDownvote = false;

    if (value === "upvote") {
      if (downindex !== -1) {
        questionDoc.downvote = questionDoc.downvote.filter(
          (id) => id !== String(userid)
        );
      }
      if (upindex === -1) {
        questionDoc.upvote.push(String(userid));
      } else {
        questionDoc.upvote = questionDoc.upvote.filter((id) => id !== String(userid));
      }
    } else if (value === "downvote") {
      if (upindex !== -1) {
        questionDoc.upvote = questionDoc.upvote.filter((id) => id !== String(userid));
      }
      if (downindex === -1) {
        questionDoc.downvote.push(String(userid));
        isNewDownvote = true;
      } else {
        questionDoc.downvote = questionDoc.downvote.filter(
          (id) => id !== String(userid)
        );
      }
    }

    await questionDoc.save();

    // Reputation Rule: -2 per downvote (deducted from question author)
    if (isNewDownvote && String(questionDoc.userid) !== String(userid)) {
      await adjustReputation(
        questionDoc.userid,
        -2,
        "downvote_deduction",
        `Downvote received on question "${questionDoc.questiontitle}"`,
        `${questionDoc._id}_downvote_${userid}`
      );
    }

    // Reputation Rule: +2 when a question reaches 10 upvotes
    if (questionDoc.upvote.length >= 10) {
      await adjustReputation(
        questionDoc.userid,
        2,
        "question_upvote_threshold",
        `Question "${questionDoc.questiontitle}" reached 10 upvotes`,
        String(questionDoc._id)
      );
    }

    res.status(200).json({ data: questionDoc });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};

export const acceptAnswer = async (req, res) => {
  const { id: questionId, answerId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(questionId) || !mongoose.Types.ObjectId.isValid(answerId)) {
    return res.status(400).json({ message: "Invalid question or answer ID" });
  }

  try {
    const ques = await question.findById(questionId);
    if (!ques) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (String(ques.userid) !== String(req.userid)) {
      return res.status(403).json({ message: "Only question author can accept an answer" });
    }

    const targetAns = ques.answer.id(answerId);
    if (!targetAns) {
      return res.status(404).json({ message: "Answer not found" });
    }

    ques.acceptedAnswerId = String(answerId);
    await ques.save();

    // Reputation Rule: +10 when an answer is accepted
    await adjustReputation(
      targetAns.userid,
      10,
      "accepted_answer",
      `Answer accepted for question "${ques.questiontitle}"`,
      String(answerId)
    );

    res.status(200).json({ data: ques });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to accept answer" });
  }
};
