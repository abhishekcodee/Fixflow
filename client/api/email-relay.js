import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { to, name, otp, resetCode, expiresInMinutes = 5, auth, secret } = req.body || {};

    const expectedSecret = process.env.JWT_SECRET || 'fixflow_production_jwt_master_secret_key_2026_super_secure_entropy_64chars';
    if (!secret || secret !== expectedSecret) {
      return res.status(401).json({ success: false, error: 'Unauthorized relay access' });
    }

    if (!to || (!otp && !resetCode)) {
      return res.status(400).json({ success: false, error: 'Missing required recipient email or code' });
    }

    const smtpUser = auth?.user || process.env.SMTP_USER || 'amanupadhyay2030@gmail.com';
    const smtpPass = auth?.pass || process.env.SMTP_PASS || 'ikpspcgzbjzqvchg';

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    const isReset = Boolean(resetCode);
    const code = otp || resetCode;
    const subject = isReset
      ? `${code} is your FixFlow password reset code`
      : `${code} is your FixFlow verification code`;

    const html = isReset
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #475569; font-size: 15px;">Hello <strong>${name || 'there'}</strong>,</p>
          <p style="color: #475569; font-size: 15px;">You requested a password reset for your FixFlow account. Use the code below:</p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #dc2626;">${code}</div>
            <div style="color: #64748b; font-size: 13px; margin-top: 6px;">Expires in ${expiresInMinutes} minutes</div>
          </div>
          <p style="color: #64748b; font-size: 13px;">If you did not request this reset, please ignore this email.</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">FixFlow Account Verification</h2>
          <p style="color: #475569; font-size: 15px;">Hello <strong>${name || 'there'}</strong>,</p>
          <p style="color: #475569; font-size: 15px;">Thank you for registering with FixFlow. Enter this 6-digit code to verify your email address:</p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7;">${code}</div>
            <div style="color: #64748b; font-size: 13px; margin-top: 6px;">Expires in ${expiresInMinutes} minutes</div>
          </div>
          <p style="color: #64748b; font-size: 13px;">This code is valid for ${expiresInMinutes} minutes. Never share this code with anyone.</p>
        </div>
      `;

    const info = await transporter.sendMail({
      from: `"FixFlow Facilities Care" <${smtpUser}>`,
      to: to.trim().toLowerCase(),
      subject,
      text: `Hello ${name || 'there'},\n\nYour FixFlow code is: ${code}\nExpires in ${expiresInMinutes} minutes.\n`,
      html
    });

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
