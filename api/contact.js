const nodemailer = require("nodemailer");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
}

module.exports = async function handler(req, res) {
  // Basic CORS/method handling
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = (body.name || "").toString().trim();
  const email = (body.email || "").toString().trim();
  const interest = (body.interest || "Not sure yet").toString().trim();
  const message = (body.message || "").toString().trim();

  if (!name || !email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please provide a valid name and email address." });
    return;
  }

  const toAddress = process.env.CONTACT_TO_EMAIL || "elizabethwellness00@gmail.com";
  const fromAddress = process.env.CONTACT_FROM_EMAIL || "hello@balancedbyelizabeth.com";

  const internalHtml = `
    <div style="font-family: Arial, sans-serif; color: #2f3b30;">
      <h2 style="margin-bottom: 4px;">New website inquiry</h2>
      <p style="color:#6b7568; margin-top:0;">Submitted via balancedbyelizabeth.com contact form</p>
      <table cellpadding="6" style="border-collapse: collapse; width: 100%; max-width: 560px;">
        <tr style="border-bottom: 1px solid #e5e5e0;">
          <td style="font-weight: 600; width: 160px; vertical-align: top;">Name</td>
          <td>${escapeHtml(name)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e5e0;">
          <td style="font-weight: 600; vertical-align: top;">Email</td>
          <td>${escapeHtml(email)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e5e0;">
          <td style="font-weight: 600; vertical-align: top;">Interested in</td>
          <td>${escapeHtml(interest)}</td>
        </tr>
      </table>
      <p style="font-weight: 600; margin-bottom: 4px;">Message</p>
      <p style="white-space: pre-wrap;">${escapeHtml(message || "—")}</p>
    </div>
  `;

  const confirmationHtml = `
    <div style="font-family: Arial, sans-serif; color: #2f3b30; max-width: 560px;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>
        Thank you for reaching out to Balanced by Elizabeth. I've received your message and
        will follow up soon to find the best next step, whether that's booking your free
        consultation or answering a few questions first.
      </p>
      <p>
        In the meantime, if anything changes or you'd like to add more detail, just reply to
        this email.
      </p>
      <p style="margin-top: 24px;">
        — Elizabeth<br />
        Balanced by Elizabeth Nutrition Counseling
      </p>
    </div>
  `;

  const transporter = getTransporter();

  if (!transporter) {
    console.log("[contact-form] SMTP not configured — logging submission instead of sending.");
    console.log({ to: toAddress, name, email, interest, message });
    res.status(200).json({ delivered: false });
    return;
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: toAddress,
      replyTo: email,
      subject: `New inquiry: ${name} — ${interest}`,
      html: internalHtml,
    });

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      replyTo: toAddress,
      subject: "Thanks for reaching out — Balanced by Elizabeth",
      html: confirmationHtml,
    });

    res.status(200).json({ delivered: true });
  } catch (err) {
    console.error("[contact-form] Failed to send email:", err);
    res.status(502).json({ error: "Could not send your message right now. Please try again shortly." });
  }
};
