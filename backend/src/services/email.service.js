import logger from '../utils/logger.js';

export async function sendPasswordOtp(email, code) {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Your Zoon password reset code', html: `<div style="font-family:Arial,sans-serif"><h2>Reset your Zoon password</h2><p>Your one-time code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>` }),
    });
    if (!response.ok) throw new Error('Could not send password reset email');
    return;
  }
  logger.info(`Development password reset OTP for ${email}: ${code}`);
}
