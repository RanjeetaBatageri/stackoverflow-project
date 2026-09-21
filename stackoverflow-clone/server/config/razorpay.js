import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

export const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID;
export const getRazorpayKeySecret = () => process.env.RAZORPAY_KEY_SECRET;
export const getWebhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET;

export const getRazorpayInstance = () => {
  const key_id = getRazorpayKeyId();
  const key_secret = getRazorpayKeySecret();

  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are missing from server environment.");
  }

  return new Razorpay({ key_id, key_secret });
};
