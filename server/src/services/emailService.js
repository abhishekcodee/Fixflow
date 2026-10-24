import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

/**
 * Creates and returns a Nodemailer transporter configured for Gmail SMTP.
 * Returns null if credentials are not configured.
 */
export const createTransporter = () => {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });
};

/**
 * Checks whether Gmail SMTP is configured with credentials.
 * @returns {boolean}
 */
export const isEmailConfigured = () => {
  return Boolean(env.SMTP_USER && env.SMTP_PASS);
};

/**
 * Professional HTML template for FixFlow Email Verification OTP.
 */
const renderVerificationHtml = ({ name, otp, expiresInMinutes = 5 }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FixFlow Email Verification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 32px 16px;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #1e40af;
      padding: 24px;
      text-align: center;
    }
    .brand-title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      color: #bfdbfe;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 4px;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .lead-text {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-box {
      background-color: #eff6ff;
      border: 2px dashed #93c5fd;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #1e3a8a;
      margin: 0;
    }
    .otp-expiry {
      font-size: 12px;
      color: #64748b;
      margin-top: 8px;
    }
    .security-notice {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .security-notice p {
      margin: 0;
      font-size: 12px;
      color: #92400e;
      line-height: 1.5;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 20px 24px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="brand-title">FixFlow</h1>
        <div class="brand-subtitle">Facilities Care & Incident Management</div>
      </div>
      <div class="content">
        <h2 class="greeting">Verify Your Email Address</h2>
        <p class="lead-text">
          Hello ${name ? name : 'there'},<br>
          Thank you for creating an account with FixFlow. Use the one-time verification code below to complete your registration.
        </p>

        <div class="otp-box">
          <div class="otp-label">Verification Code (OTP)</div>
          <div class="otp-code">${otp}</div>
          <div class="otp-expiry">Expires in ${expiresInMinutes} minutes</div>
        </div>

        <div class="security-notice">
          <p>
            <strong>Security Notice:</strong> Never share this code with anyone. FixFlow staff and facility administrators will never ask for your verification code.
          </p>
        </div>

        <p class="lead-text" style="margin-bottom: 0; font-size: 12px;">
          If you did not request this account registration, please ignore this email. No account will be created without this verification code.
        </p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} FixFlow Incident Care & Facilities System. All rights reserved.</p>
        <p>This is an automated security transmission. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Professional HTML template for FixFlow Password Reset OTP.
 */
const renderPasswordResetHtml = ({ name, resetCode, expiresInMinutes = 15 }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FixFlow Password Reset Request</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 32px 16px;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #1e40af;
      padding: 24px;
      text-align: center;
    }
    .brand-title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      color: #bfdbfe;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 4px;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .lead-text {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-box {
      background-color: #fef2f2;
      border: 2px dashed #fca5a5;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #b91c1c;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #991b1b;
      margin: 0;
    }
    .otp-expiry {
      font-size: 12px;
      color: #64748b;
      margin-top: 8px;
    }
    .security-notice {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .security-notice p {
      margin: 0;
      font-size: 12px;
      color: #92400e;
      line-height: 1.5;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 20px 24px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="brand-title">FixFlow</h1>
        <div class="brand-subtitle">Facilities Care & Incident Management</div>
      </div>
      <div class="content">
        <h2 class="greeting">Password Reset Request</h2>
        <p class="lead-text">
          Hello ${name ? name : 'there'},<br>
          We received a request to reset your password for your FixFlow account. Enter the verification code below on the password reset page to create your new password.
        </p>

        <div class="otp-box">
          <div class="otp-label">Password Reset Code</div>
          <div class="otp-code">${resetCode}</div>
          <div class="otp-expiry">Valid for ${expiresInMinutes} minutes</div>
        </div>

        <div class="security-notice">
          <p>
            <strong>Security Warning:</strong> If you did not initiate this password reset request, someone may be trying to access your account. Your password remains unchanged.
          </p>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} FixFlow Incident Care & Facilities System. All rights reserved.</p>
        <p>This is an automated security transmission. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Sends a real verification OTP email via Gmail SMTP.
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.otp - 6-digit OTP code
 * @param {number} [options.expiresInMinutes=5]
 */
export const sendVerificationOtpEmail = async ({ to, name, otp, expiresInMinutes = 5 }) => {
  if (!isEmailConfigured()) {
    throw new AppError(
      'Gmail SMTP service is not configured. Please set SMTP_USER and SMTP_PASS (Google App Password) in server/.env.',
      503,
      'EMAIL_SERVICE_NOT_CONFIGURED'
    );
  }

  const transporter = createTransporter();
  const mailOptions = {
    from: `"${env.FROM_NAME}" <${env.FROM_EMAIL}>`,
    to: to.trim().toLowerCase(),
    subject: `${otp} is your FixFlow verification code`,
    text: `Hello ${name || 'there'},\n\nYour FixFlow email verification code is: ${otp}\n\nThis code will expire in ${expiresInMinutes} minutes.\n\nIf you did not request this code, please ignore this message.`,
    html: renderVerificationHtml({ name, otp, expiresInMinutes })
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Verification OTP email dispatched to ${to} (Message ID: ${info.messageId})`);
    return info;
  } catch (err) {
    logger.error(`Nodemailer delivery failure to ${to}: ${err.message}`);
    throw new AppError(
      `Email delivery failed via Gmail SMTP: ${err.message}`,
      502,
      'EMAIL_DELIVERY_FAILED'
    );
  }
};

/**
 * Sends a real password reset OTP email via Gmail SMTP.
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.resetCode - 6-digit reset code
 * @param {number} [options.expiresInMinutes=15]
 */
export const sendPasswordResetEmail = async ({ to, name, resetCode, expiresInMinutes = 15 }) => {
  if (!isEmailConfigured()) {
    throw new AppError(
      'Gmail SMTP service is not configured. Please set SMTP_USER and SMTP_PASS (Google App Password) in server/.env.',
      503,
      'EMAIL_SERVICE_NOT_CONFIGURED'
    );
  }

  const transporter = createTransporter();
  const mailOptions = {
    from: `"${env.FROM_NAME}" <${env.FROM_EMAIL}>`,
    to: to.trim().toLowerCase(),
    subject: `${resetCode} is your FixFlow password reset code`,
    text: `Hello ${name || 'there'},\n\nYour FixFlow password reset code is: ${resetCode}\n\nThis code is valid for ${expiresInMinutes} minutes.\n\nIf you did not request a password reset, please ignore this email.`,
    html: renderPasswordResetHtml({ name, resetCode, expiresInMinutes })
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Password reset email dispatched to ${to} (Message ID: ${info.messageId})`);
    return info;
  } catch (err) {
    logger.error(`Nodemailer reset email failure to ${to}: ${err.message}`);
    throw new AppError(
      `Email delivery failed via Gmail SMTP: ${err.message}`,
      502,
      'EMAIL_DELIVERY_FAILED'
    );
  }
};

export default {
  createTransporter,
  isEmailConfigured,
  sendVerificationOtpEmail,
  sendPasswordResetEmail
};
