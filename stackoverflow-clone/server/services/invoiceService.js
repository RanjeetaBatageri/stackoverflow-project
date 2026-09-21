import PDFDocument from "pdfkit";
import Invoice from "../models/invoice.js";
import User from "../models/auth.js";

export const generateInvoicePDF = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId).populate("userId", "name email");
  if (!invoice) throw new Error("Invoice not found");

  const doc = new PDFDocument({ margin: 50 });

  // Header
  doc.fillColor("#444444").fontSize(20).text("STACK OVERFLOW CLONE", 50, 50);
  doc.fontSize(10).text("Subscription & Membership Receipt", 50, 75);
  doc.moveDown();

  // Divider
  doc.strokeColor("#cccccc").lineWidth(1).moveTo(50, 95).lineTo(550, 95).stroke();

  // Invoice Details
  doc.fontSize(12).fillColor("#000000");
  doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 50, 115);
  doc.text(`Date: ${new Date(invoice.billingDate).toLocaleDateString("en-IN")}`, 50, 135);
  doc.text(`Payment Status: ${invoice.status.toUpperCase()}`, 50, 155);

  // Customer Details
  doc.text(`Billed To:`, 350, 115);
  doc.fontSize(10).fillColor("#555555");
  doc.text(`${invoice.userId?.name || "Customer"}`, 350, 135);
  doc.text(`${invoice.userId?.email || ""}`, 350, 150);

  doc.moveDown(2);

  // Table Header
  const tableTop = 200;
  doc.fillColor("#333333").fontSize(11).text("Description", 50, tableTop);
  doc.text("Plan Tier", 250, tableTop);
  doc.text("Amount (INR)", 450, tableTop);
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, tableTop + 18).lineTo(550, tableTop + 18).stroke();

  // Table Item
  const itemTop = tableTop + 30;
  doc.fillColor("#000000").fontSize(10);
  doc.text(`Stack Overflow ${invoice.plan.toUpperCase()} Membership (Monthly)`, 50, itemTop);
  doc.text(`${invoice.plan.toUpperCase()}`, 250, itemTop);
  doc.text(`₹${invoice.amount}`, 450, itemTop);

  doc.strokeColor("#eeeeee").lineWidth(1).moveTo(50, itemTop + 20).lineTo(550, itemTop + 20).stroke();

  // Total
  const totalTop = itemTop + 35;
  doc.fontSize(12).fillColor("#000000").text("Total Paid:", 350, totalTop);
  doc.fontSize(14).fillColor("#16a34a").text(`₹${invoice.amount} INR`, 450, totalTop);

  // Footer
  doc.fontSize(9).fillColor("#777777").text("Thank you for subscribing to Stack Overflow Premium!", 50, 450, {
    align: "center",
    width: 500,
  });

  doc.end();
  return doc;
};
