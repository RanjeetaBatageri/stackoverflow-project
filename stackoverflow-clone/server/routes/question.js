import express from "express";
import {
  Askquestion,
  deletequestion,
  getallquestion,
  votequestion,
  acceptAnswer,
} from "../controller/question.js";

const router = express.Router();
import auth from "../middleware/auth.js";
router.post("/ask", auth, Askquestion);
router.get("/getallquestion", getallquestion);
router.delete("/delete/:id", auth, deletequestion);
router.patch("/vote/:id", auth, votequestion);
router.patch("/accept/:id/:answerId", auth, acceptAnswer);

export default router;

