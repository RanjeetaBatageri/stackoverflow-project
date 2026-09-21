import crypto from "crypto";
import { PLANS, getPlanConfig } from "../config/plans.js";
import { getRazorpayInstance, getRazorpayKeyId, getRazorpayKeySecret, getWebhookSecret } from "../config/razorpay.js";
import User from "../models/auth.js";
import Payment from "../models/payment.js";
import Subscription from "../models/subscription.js";
import Invoice from "../models/invoice.js";
import { generateInvoicePDF } from "../services/invoiceService.js";
import { sendPaymentConfirmationEmail } from "../services/emailService.js";
import { getEffectivePlan, canAskQuestion } from "../services/planPermissions.js";

// Create Razorpay Order or Subscription (Strictly Server-Side Price & Plan Enforcement)
export const createOrder = async (req, res) => {
  const userId = req.userid;
  const { plan: requestedPlan } = req.body;

  if (!requestedPlan || !PLANS[requestedPlan] || requestedPlan === "free") {
    return res.status(400).json({ message: "Invalid subscription plan selected" });
  }

  // Server determines exact price and plan details from server configuration
  const planConfig = getPlanConfig(requestedPlan);
  const amountInPaise = planConfig.price * 100;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let razorpayInstance;
    try {
      razorpayInstance = getRazorpayInstance();
    } catch (configErr) {
      return res.status(500).json({
        message: "Razorpay integration is not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server environment.",
      });
    }

    const receipt = `rcpt_${userId.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;
    let razorpayOrderId = null;
    let razorpaySubscriptionId = null;

    // Require configured Razorpay Subscription Plan ID for recurring subscriptions
    if (!planConfig.razorpayPlanId) {
      return res.status(503).json({
        message: `Razorpay Subscription Plan ID for ${planConfig.name} plan (RAZORPAY_PLAN_${requestedPlan.toUpperCase()}) is not configured on the server. Please configure it in server environment.`,
      });
    }

    const razorpaySub = await razorpayInstance.subscriptions.create({
      plan_id: planConfig.razorpayPlanId,
      customer_notify: 1,
      total_count: 12, // 12 monthly recurring cycles
      notes: { userId: userId.toString(), plan: requestedPlan },
    });
    const razorpaySubscriptionId = razorpaySub.id;

    // Record initial payment intent
    const newPayment = await Payment.create({
      userId,
      plan: requestedPlan,
      amount: planConfig.price,
      currency: "INR",
      status: "created",
      razorpayOrderId,
      razorpaySubscriptionId,
    });

    res.status(200).json({
      success: true,
      keyId: getRazorpayKeyId(),
      amount: amountInPaise, // Enforced server-side
      currency: "INR",
      plan: planConfig,
      orderId: razorpayOrderId,
      subscriptionId: razorpaySubscriptionId,
      paymentRecordId: newPayment._id,
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: "Failed to initiate Razorpay payment process", error: error.message });
  }
};

// Verify Payment Signature & Activate Subscription (Strict HMAC-SHA256 & Idempotent)
export const verifyPayment = async (req, res) => {
  const userId = req.userid;
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_subscription_id,
    razorpay_signature,
    plan: requestedPlan,
  } = req.body;

  if (!requestedPlan || !PLANS[requestedPlan] || requestedPlan === "free") {
    return res.status(400).json({ message: "Invalid subscription plan specified for verification" });
  }

  if (!razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: "Missing Razorpay payment ID or signature" });
  }

  const keySecret = getRazorpayKeySecret();
  if (!keySecret) {
    return res.status(500).json({ message: "Server Razorpay secret is not configured" });
  }

  // Strict HMAC-SHA256 Signature Verification
  let isValidSignature = false;
  if (razorpay_subscription_id) {
    const body = razorpay_payment_id + "|" + razorpay_subscription_id;
    const expectedSignature = crypto.createHmac("sha256", keySecret).update(body.toString()).digest("hex");
    isValidSignature = expectedSignature === razorpay_signature;
  } else if (razorpay_order_id) {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", keySecret).update(body.toString()).digest("hex");
    isValidSignature = expectedSignature === razorpay_signature;
  }

  if (!isValidSignature) {
    return res.status(400).json({ message: "Payment verification failed: Invalid signature" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const planConfig = getPlanConfig(requestedPlan);

    // IDEMPOTENCY CHECK: Check if this payment ID has already been recorded and activated
    let existingPayment = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id, status: "paid" });
    let existingInvoice = existingPayment ? await Invoice.findOne({ paymentId: existingPayment._id }) : null;

    if (existingPayment && existingInvoice) {
      return res.status(200).json({
        success: true,
        message: `Subscription already active for ${planConfig.name} Plan (Idempotent call)`,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionEndDate: user.subscriptionEndDate,
          badge: planConfig.badge,
        },
        invoiceId: existingInvoice._id,
      });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30-day billing period

    // Create or update Subscription record
    let subRecord = await Subscription.findOne({ userId });
    if (!subRecord) {
      subRecord = new Subscription({ userId, plan: requestedPlan });
    }
    subRecord.plan = requestedPlan;
    subRecord.status = "active";
    subRecord.startDate = startDate;
    subRecord.renewalDate = endDate;
    subRecord.endDate = endDate;
    subRecord.cancelAtPeriodEnd = false;
    if (razorpay_subscription_id) subRecord.razorpaySubscriptionId = razorpay_subscription_id;
    await subRecord.save();

    // Update User record
    user.plan = requestedPlan;
    user.subscriptionStatus = "active";
    user.subscriptionEndDate = endDate;
    user.cancelAtPeriodEnd = false;
    if (razorpay_subscription_id) user.razorpaySubscriptionId = razorpay_subscription_id;
    await user.save();

    // Create Payment record
    const payment = await Payment.create({
      userId,
      plan: requestedPlan,
      amount: planConfig.price, // Server-enforced amount
      currency: "INR",
      status: "paid",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySubscriptionId: razorpay_subscription_id,
    });

    // Generate Unique Invoice Record
    const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const invoice = await Invoice.create({
      invoiceNumber: invoiceNum,
      userId,
      paymentId: payment._id,
      subscriptionId: subRecord._id,
      plan: requestedPlan,
      amount: planConfig.price,
      currency: "INR",
      status: "paid",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
    });

    payment.invoiceId = invoice._id;
    await payment.save();

    // Dispatch Payment Confirmation Email safely (Non-fatal if SMTP is missing or fails)
    if (!invoice.confirmationEmailSent) {
      try {
        const emailRes = await sendPaymentConfirmationEmail({
          user,
          payment,
          subscription: subRecord,
          invoice,
        });
        if (emailRes.success) {
          invoice.confirmationEmailSent = true;
          await invoice.save();
        }
      } catch (emailErr) {
        console.error("Non-fatal confirmation email failure:", emailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully activated ${planConfig.name} Subscription!`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
        badge: planConfig.badge,
      },
      invoiceId: invoice._id,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({ message: "Failed to process payment activation" });
  }
};

// Razorpay Webhook Handler (Strict Signature Verification & Idempotency)
export const handleWebhook = async (req, res) => {
  const secret = getWebhookSecret();
  const signature = req.headers["x-razorpay-signature"];

  if (!secret) {
    return res.status(500).json({ status: "error", message: "RAZORPAY_WEBHOOK_SECRET is not configured" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (expectedSignature !== signature) {
    return res.status(400).json({ status: "invalid_signature" });
  }

  const event = req.body?.event;
  const payload = req.body?.payload;

  try {
    if (event === "subscription.charged" || event === "payment.captured") {
      const subId = payload?.subscription?.entity?.id || payload?.payment?.entity?.subscription_id;
      const paymentId = payload?.payment?.entity?.id;

      if (subId) {
        const sub = await Subscription.findOne({ razorpaySubscriptionId: subId });
        if (sub) {
          sub.status = "active";
          const newEndDate = new Date();
          newEndDate.setDate(newEndDate.getDate() + 30);
          sub.renewalDate = newEndDate;
          sub.endDate = newEndDate;
          await sub.save();

          const user = await User.findByIdAndUpdate(sub.userId, {
            plan: sub.plan,
            subscriptionStatus: "active",
            subscriptionEndDate: newEndDate,
          }, { new: true });

          // IDEMPOTENT Invoice & Payment Creation for recurring renewal webhooks
          if (paymentId) {
            let payment = await Payment.findOne({ razorpayPaymentId: paymentId });
            if (!payment) {
              const planConfig = getPlanConfig(sub.plan);
              payment = await Payment.create({
                userId: sub.userId,
                plan: sub.plan,
                amount: planConfig.price,
                currency: "INR",
                status: "paid",
                razorpayPaymentId: paymentId,
                razorpaySubscriptionId: subId,
              });

              const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
              const invoice = await Invoice.create({
                invoiceNumber: invoiceNum,
                userId: sub.userId,
                paymentId: payment._id,
                subscriptionId: sub._id,
                plan: sub.plan,
                amount: planConfig.price,
                currency: "INR",
                status: "paid",
                razorpayPaymentId: paymentId,
              });

              payment.invoiceId = invoice._id;
              await payment.save();

              // Send email safely
              if (user && !invoice.confirmationEmailSent) {
                const emailRes = await sendPaymentConfirmationEmail({
                  user,
                  payment,
                  subscription: sub,
                  invoice,
                });
                if (emailRes.success) {
                  invoice.confirmationEmailSent = true;
                  await invoice.save();
                }
              }
            }
          }
        }
      }
    } else if (event === "subscription.halted" || event === "subscription.cancelled") {
      const subId = payload?.subscription?.entity?.id;
      if (subId) {
        const sub = await Subscription.findOne({ razorpaySubscriptionId: subId });
        if (sub) {
          sub.status = event === "subscription.halted" ? "halted" : "cancelled";
          await sub.save();

          await User.findByIdAndUpdate(sub.userId, {
            subscriptionStatus: sub.status,
            plan: sub.status === "cancelled" ? "free" : sub.plan,
          });
        }
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ status: "error" });
  }
};

// Get current user's subscription details & daily question entitlement
export const getMySubscription = async (req, res) => {
  const userId = req.userid;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const effectivePlan = getEffectivePlan(user);
    const planConfig = getPlanConfig(effectivePlan);

    const todayStr = new Date().toISOString().split("T")[0];
    const lastDateStr = user.lastQuestionDate ? new Date(user.lastQuestionDate).toISOString().split("T")[0] : null;
    const questionsToday = lastDateStr === todayStr ? user.dailyQuestionCount || 0 : 0;

    const check = canAskQuestion(user, questionsToday);

    const subscription = await Subscription.findOne({ userId });

    res.status(200).json({
      plan: effectivePlan,
      planConfig,
      subscriptionStatus: user.subscriptionStatus || "none",
      subscriptionEndDate: user.subscriptionEndDate,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd || false,
      dailyQuestions: {
        limit: check.limit,
        used: check.used,
        remaining: check.remaining,
      },
      badge: planConfig.badge,
      subscriptionDetails: subscription || null,
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({ message: "Failed to fetch subscription status" });
  }
};

// Cancel Subscription (Period End)
export const cancelSubscription = async (req, res) => {
  const userId = req.userid;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cancelAtPeriodEnd = true;
    user.subscriptionStatus = "cancelled";
    await user.save();

    await Subscription.findOneAndUpdate({ userId }, { cancelAtPeriodEnd: true, status: "cancelled" });

    res.status(200).json({ message: "Subscription will be cancelled at period end", cancelAtPeriodEnd: true });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
};

// Get Invoices List
export const getInvoices = async (req, res) => {
  const userId = req.userid;
  try {
    const invoices = await Invoice.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ invoices });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
};

// Download Invoice PDF (Secured with Ownership Check)
export const downloadInvoice = async (req, res) => {
  const { id } = req.params;
  const userId = req.userid;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // STRICT AUTHORIZATION CHECK: User can only download their own invoice
    if (invoice.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Access denied: You can only download your own invoices" });
    }

    const doc = await generateInvoicePDF(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Invoice-${invoice.invoiceNumber}.pdf`);
    doc.pipe(res);
  } catch (error) {
    console.error("Download invoice error:", error);
    res.status(500).json({ message: "Failed to generate invoice PDF" });
  }
};
