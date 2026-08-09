import nodemailer from "nodemailer";

const smtpUser = process.env.NODEMAILER_USER?.trim();
const smtpPass = process.env.NODEMAILER_PASS?.trim();

if (!smtpUser || !smtpPass) {
  console.warn(
    "Email is not configured: NODEMAILER_USER and NODEMAILER_PASS are required.",
  );
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

const sendNodemailerMail = async (to, sub, OTP) => {
  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP credentials are not configured");
  }

  const otpHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chatrix Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fb;padding:40px 0;">
  <tr>
    <td align="center">

      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td align="center" style="background:#2563eb;padding:32px;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">
              Chatrix
            </h1>
            <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">
              Modern Real-Time Communication Platform
            </p>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:40px 35px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:24px;">
              Verify Your Email Address
            </h2>

            <p style="margin:0 0 20px;color:#4b5563;font-size:16px;line-height:1.6;">
              Thank you for choosing Chatrix. To complete your account verification,
              please use the One-Time Password (OTP) below.
            </p>

            <!-- OTP Box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:20px 0;">
                  <div style="
                    display:inline-block;
                    padding:18px 40px;
                    background:#eff6ff;
                    border:2px dashed #2563eb;
                    border-radius:10px;
                    font-size:36px;
                    font-weight:700;
                    letter-spacing:8px;
                    color:#2563eb;
                  ">
                    ${OTP}
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:20px 0;color:#4b5563;font-size:15px;line-height:1.6;">
              This code is valid for <strong>10 minutes</strong>.
              For your security, please do not share this code with anyone.
            </p>

            <p style="margin:20px 0 0;color:#4b5563;font-size:15px;line-height:1.6;">
              If you did not request this verification, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px;text-align:center;">
            <p style="margin:0;color:#6b7280;font-size:13px;">
              © 2026 Chatrix. All rights reserved.
            </p>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
              Secure • Fast • Real-Time Communication
            </p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
  </html>`;
  try {
    return await transporter.sendMail({
      from: smtpUser,
      to: to,
      subject: sub,
      html: otpHtml,
    });
  } catch (error) {
    console.error("Failed to send email", {
      code: error?.code,
      responseCode: error?.responseCode,
      command: error?.command,
      response: error?.response,
    });
    throw error;
  }
};

export { sendNodemailerMail };
