import express from "express";
import auth from "../middleware/auth.js";
import {
  createOrder,
  verifyPayment,
  handleWebhook,
  getMySubscription,
  cancelSubscription,
  getInvoices,
  downloadInvoice,
} from "../controller/subscription.js";

const router = express.Router();

router.post("/create-order", auth, createOrder);
router.post("/verify", auth, verifyPayment);
router.post("/webhook", handleWebhook);
router.get("/my-subscription", auth, getMySubscription);
router.post("/cancel", auth, cancelSubscription);
router.get("/invoices", auth, getInvoices);
router.get("/invoice/:id/download", auth, downloadInvoice);

export default router;
