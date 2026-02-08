import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM || "noreply@sso.local";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      console.warn(
        "⚠️  Email configuration missing. Email verification will be disabled."
      );
      console.warn("Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD env variables.");
      return null;
    }

    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
  }

  return transporter;
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationToken: string
): Promise<boolean> {
  // Email verification has been removed from the system
  return true;
}

export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<boolean> {
  try {
    const transport = getTransporter();
    if (!transport) {
      console.warn(`Email disabled. Would send welcome to ${email}`);
      return true;
    }

    const mailOptions = {
      from: SMTP_FROM,
      to: email,
      subject: "Welcome to SSO!",
      html: `
        <h2>Welcome ${name}!</h2>
        <p>Your email has been verified successfully.</p>
        <p>You can now use your account to log in to all connected applications.</p>
        <p>Happy to have you on board!</p>
      `,
      text: `
        Welcome ${name}!
        
        Your email has been verified successfully.
        You can now use your account to log in to all connected applications.
        
        Happy to have you on board!
      `,
    };

    await transport.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return false;
  }
}
