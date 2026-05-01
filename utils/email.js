const nodemailer = require('nodemailer');
const dns = require('dns');

/**
 * Send QR Email to attendee using Resend HTTP API
 * This bypasses SMTP blocks and connection timeouts.
 */
const sendQrEmail = async (attendee, qrCodeDataUrl, customMessage = '') => {
  const apiKey = process.env.SMTP_PASS; // Using the key from env

  if (!apiKey) {
    console.log(`[NO_API_KEY] QR Link for ${attendee.email || attendee.roll}: ${attendee.qrLink}`);
    return;
  }

  if (!attendee.email) {
    console.log(`[SKIP_EMAIL] Attendee ${attendee.roll} has no email.`);
    return;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color: #4F46E5; text-align: center;">Hello, ${attendee.name}!</h2>
      
      ${customMessage ? `<div style="background-color: #EEF2FF; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4F46E5; color: #3730A3;">${customMessage}</div>` : '<p>Thank you for registering for our event. Below is your unique QR code for entry.</p>'}
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="font-size: 14px; color: #6b7280;">Your QR Code is attached to this email.</p>
      </div>

      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Or use this secure access link:</p>
        <p style="margin: 10px 0 0 0; word-break: break-all;"><a href="${attendee.qrLink}" style="color: #4F46E5; font-weight: bold;">${attendee.qrLink}</a></p>
      </div>

      <p>Please keep this email handy for verification at the entrance.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">&copy; ${new Date().getFullYear()} Event Management Team</p>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: 'Event Team <onboarding@resend.dev>', // Note: Replace with your verified domain later
        to: attendee.email,
        subject: 'Your QR Access Code for the Event',
        html: html,
        attachments: [
          {
            filename: 'qrcode.png',
            content: qrCodeDataUrl.split('base64,')[1]
          }
        ]
      })
    });

    const result = await response.json();
    if (response.ok) {
      console.log(`QR Email sent via API to ${attendee.email}`);
    } else {
      console.error(`Resend API Error for ${attendee.email}:`, result);
      throw new Error(result.message || 'Failed to send email via API');
    }
  } catch (error) {
    console.error(`Failed to send QR Email to ${attendee.email}:`, error.message);
    throw error;
  }
};

module.exports = {
  transporter,
  sendQrEmail
};
