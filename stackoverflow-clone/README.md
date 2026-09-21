# Stack Overflow Clone - Subscription & Premium Membership System

This project is an internship training project extending a Stack Overflow Clone with a complete **Subscription & Premium Membership System**, Razorpay integration, server-side daily question limit enforcement, dynamic PDF tax invoices, and automated payment confirmation emails.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Next.js 15 (Pages Router), React 19, TypeScript, Tailwind CSS (`stackoverflow-clone/stack`)
- **Backend**: Node.js, Express 5, Mongoose (`stackoverflow-clone/server`)
- **Database**: MongoDB
- **Payments**: Razorpay (Orders API & Subscriptions API with HMAC-SHA256 signature verification)
- **PDF Generation**: PDFKit
- **Email Confirmation**: Nodemailer

---

## 🚀 Environment & Setup Configuration

Create a `.env` file inside `stackoverflow-clone/server/` using `server/.env.example` as a template:

```env
PORT=5000
MONGODB_URL=mongodb://localhost:27017/stackoverflow
JWT_SECRET=your_jwt_secret_key_here
FRONTEND_URL=http://localhost:3000

# Razorpay API Credentials
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret_here

# SMTP Email Configuration (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
EMAIL_FROM="Stack Overflow Clone" <no-reply@stackoverflow-clone.com>
```

> [!WARNING]
> **Security Notice**: Never commit `.env` or expose API keys/SMTP passwords in client-side code or public repositories. The `.gitignore` file is configured to exclude all `.env` files automatically.

---

## 📧 Email Confirmation & Testing Guide

When a payment is verified, the server automatically generates a unique tax invoice (`INV-YYYY-XXXXXX`) and sends a payment confirmation email to the user's registered address.

### Email Configuration Options:

1. **Production / Real SMTP (e.g. Gmail / SendGrid / Mailgun)**:
   - Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` in `server/.env`.
   - For Gmail, generate an **App Password** under Google Account Security settings.

2. **Development / Test SMTP (e.g. Ethereal Email / Mailtrap)**:
   - Use test SMTP credentials provided by [Ethereal.email](https://ethereal.email) or [Mailtrap.io](https://mailtrap.io).
   - Ethereal automatically catches sent emails for viewing in a test inbox.

3. **Fallback / Simulated Delivery Mode**:
   - If SMTP environment variables are left empty during local testing, the backend will log simulated email delivery details to the server log without throwing errors or breaking subscription activation.

---

## 🔒 Reliability & Duplicate Prevention

- **Idempotent Emailing**: The `Invoice` model tracks `confirmationEmailSent: true` to prevent duplicate emails during Razorpay webhook retries.
- **Safe Execution**: Email transport errors are logged server-side and will **never** roll back a valid payment or deactivate an active subscription.
