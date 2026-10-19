import mongoose from "mongoose";
import question from "../models/question.js";

import { adjustReputation } from "../services/reputation.js";

export const Askanswer = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "question unavailable" });
  }
  const { noofanswer, answerbody, useranswered } = req.body;
  const userid = req.userid; // Use authenticated user ID

  try {
    const targetQues = await question.findById(_id);
    if (!targetQues) {
      return res.status(404).json({ message: "question unavailable" });
    }

    const newAnswerObj = { answerbody, useranswered, userid };
    targetQues.answer.push(newAnswerObj);
    targetQues.noofanswer = targetQues.answer.length;
    await targetQues.save();

    const createdAnswer = targetQues.answer[targetQues.answer.length - 1];

    // Reputation Rule: +5 for posting an answer
    await adjustReputation(
      userid,
      5,
      "post_answer",
      `Posted answer to question "${targetQues.questiontitle}"`,
      String(createdAnswer._id)
    );

    res.status(200).json({ data: targetQues });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};

export const deleteanswer = async (req, res) => {
  const { id: _id } = req.params;
  const { answerid } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "question unavailable" });
  }
  if (!mongoose.Types.ObjectId.isValid(answerid)) {
    return res.status(400).json({ message: "answer unavailable" });
  }

  try {
    const targetQues = await question.findById(_id);
    if (!targetQues) {
      return res.status(404).json({ message: "question unavailable" });
    }

    const targetAnswer = targetQues.answer.id(answerid);
    if (!targetAnswer) {
      return res.status(404).json({ message: "answer unavailable" });
    }

    const answerAuthorId = targetAnswer.userid;
    targetQues.answer.pull({ _id: answerid });
    targetQues.noofanswer = targetQues.answer.length;
    await targetQues.save();

    // Reputation Rule: -5 when answer author deletes their own answer
    if (String(answerAuthorId) === String(req.userid)) {
      await adjustReputation(
        answerAuthorId,
        -5,
        "delete_own_answer_deduction",
        `Deleted own answer from question "${targetQues.questiontitle}"`,
        String(answerid)
      );
    }

    res.status(200).json({ data: targetQues });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};
