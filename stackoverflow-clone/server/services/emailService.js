import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create transporter using environment variables or test fallback
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: { user, pass },
    });
  }

  // Fallback for local testing / development when SMTP credentials are not configured
  return null;
};

export const sendPaymentConfirmationEmail = async ({ user, payment, subscription, invoice }) => {
  const recipientEmail = user.email;
  const fromEmail = process.env.EMAIL_FROM || '"Stack Overflow Clone" <no-reply@stackoverflow-clone.com>';
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const planName = (invoice.plan || payment.plan || "Premium").toUpperCase();
  const amountPaid = invoice.amount || payment.amount;
  const currency = invoice.currency || payment.currency || "INR";
  const invoiceNum = invoice.invoiceNumber;
  const paymentRef = payment.razorpayPaymentId || payment.razorpayOrderId || payment._id.toString();
  const paymentDate = new Date(invoice.billingDate || Date.now()).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const startDate = subscription?.startDate
    ? new Date(subscription.startDate).toLocaleDateString("en-IN")
    : paymentDate;
  const renewalDate = subscription?.renewalDate
    ? new Date(subscription.renewalDate).toLocaleDateString("en-IN")
    : "30 days from activation";

  const invoiceDownloadUrl = `${frontendUrl}/users/${user._id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Confirmation & Invoice</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #232629; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border-top: 4px solid #f97316; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; }
          .header { padding: 24px; text-align: center; border-bottom: 1px solid #e3e6e8; background: #fafafb; }
          .header h1 { margin: 0; color: #f97316; font-size: 22px; font-weight: 700; }
          .header p { margin: 4px 0 0 0; color: #6a737c; font-size: 13px; }
          .content { padding: 28px; }
          .success-badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
          .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          .details-table th, .details-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e3e6e8; }
          .details-table th { background: #f8f9f9; color: #525960; font-weight: 600; width: 40%; }
          .details-table td { color: #232629; font-weight: 500; }
          .btn { display: inline-block; background: #f97316; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 20px; text-align: center; }
          .footer { padding: 20px; background: #fafafb; text-align: center; font-size: 12px; color: #6a737c; border-top: 1px solid #e3e6e8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Stack Overflow Clone</h1>
            <p>Subscription & Payment Confirmation</p>
          </div>
          <div class="content">
            <div class="success-badge">✓ Payment Successful</div>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>Thank you for subscribing! Your payment has been successfully processed and your <strong>${planName}</strong> plan membership is now active.</p>

            <table class="details-table">
              <tr>
                <th>Invoice Number</th>
                <td><strong>${invoiceNum}</strong></td>
              </tr>
              <tr>
                <th>Subscription Plan</th>
                <td>${planName} Membership</td>
              </tr>
              <tr>
                <th>Amount Paid</th>
                <td><strong>₹${amountPaid} ${currency}</strong></td>
              </tr>
              <tr>
                <th>Payment Status</th>
                <td>Paid (Active)</td>
              </tr>
              <tr>
                <th>Payment Reference ID</th>
                <td>${paymentRef}</td>
              </tr>
              <tr>
                <th>Payment Date</th>
                <td>${paymentDate}</td>
              </tr>
              <tr>
                <th>Subscription Start</th>
                <td>${startDate}</td>
              </tr>
              <tr>
                <th>Next Renewal Date</th>
                <td>${renewalDate}</td>
              </tr>
            </table>

            <p style="margin-top: 24px;">You can view and download your full tax invoice PDF directly from your account profile dashboard at any time.</p>
            
            <a href="${invoiceDownloadUrl}" class="btn">View Account & Invoice Dashboard</a>
          </div>
          <div class="footer">
            <p>If you have any questions regarding your invoice or membership, contact our priority support.</p>
            <p>© ${new Date().getFullYear()} Stack Overflow Clone. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
STACK OVERFLOW CLONE - PAYMENT CONFIRMATION & INVOICE

Hello ${user.name},

Thank you for your payment! Your subscription to the ${planName} Plan has been successfully activated.

INVOICE & SUBSCRIPTION DETAILS:
----------------------------------
Invoice Number: ${invoiceNum}
Subscription Plan: ${planName}
Amount Paid: ₹${amountPaid} ${currency}
Payment Status: Paid (Active)
Payment Reference ID: ${paymentRef}
Payment Date: ${paymentDate}
Subscription Start Date: ${startDate}
Next Renewal Date: ${renewalDate}

You can log in to your account at ${invoiceDownloadUrl} to download your complete PDF invoice receipt.

Thank you for being part of the developer community!
  `;

  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log(`[SMTP Notice] SMTP host/credentials not configured in .env. Simulated email delivery to: ${recipientEmail} for Invoice #${invoiceNum}`);
      return { success: true, simulated: true };
    }

    const info = await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject: `Payment Confirmation & Tax Invoice [${invoiceNum}] - Stack Overflow Clone`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Confirmation email sent successfully to ${recipientEmail} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email dispatch error for ${recipientEmail}:`, error.message);
    // Return error without breaking the calling subscription flow
    return { success: false, error: error.message };
  }
};
