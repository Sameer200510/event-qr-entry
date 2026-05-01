const nodemailer = require('nodemailer');
const dns = require('dns');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, 
  pool: true, // Use connection pooling for bulk emails
  maxConnections: 3,
  connectionTimeout: 20000, // 20 seconds timeout
  greetingTimeout: 20000,
  socketTimeout: 20000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  family: 4 // Force IPv4
});

/**
 * Send QR Email to attendee
 */
const sendQrEmail = async (attendee, qrCodeDataUrl, customMessage = '') => {
  if (!process.env.SMTP_USER) {
    console.log(`[NO_SMTP_ENV] QR Link for ${attendee.email || attendee.roll}: ${attendee.qrLink}`);
    return;
  }

  if (!attendee.email) {
    console.log(`[SKIP_EMAIL] Attendee ${attendee.roll} has no email.`);
    return;
  }

  const mailOptions = {
    from: `"Event Team" <${process.env.SMTP_USER}>`,
    to: attendee.email,
    subject: 'Your QR Access Code for the Event',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #4F46E5; text-align: center;">Hello, ${attendee.name}!</h2>
        
        ${customMessage ? `<div style="background-color: #EEF2FF; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4F46E5; color: #3730A3;">${customMessage}</div>` : '<p>Thank you for registering for our event. Below is your unique QR code for entry.</p>'}
        
        <div style="text-align: center; margin: 30px 0;">
          <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px; border: 5px solid #f3f4f6; border-radius: 10px;" />
        </div>

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">If the QR code doesn't load, you can use this access link:</p>
          <p style="margin: 10px 0 0 0; word-break: break-all;"><a href="${attendee.qrLink}" style="color: #4F46E5; font-weight: bold;">${attendee.qrLink}</a></p>
        </div>

        <p>Please keep this email handy for verification at the entrance.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">&copy; ${new Date().getFullYear()} Event Management Team</p>
      </div>
    `,
    attachments: [
      {
        filename: 'qrcode.png',
        content: qrCodeDataUrl.split('base64,')[1],
        encoding: 'base64',
        cid: 'qrcode'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`QR Email sent to ${attendee.email}`);
  } catch (error) {
    console.error(`Failed to send QR Email to ${attendee.email}:`, error);
    throw error;
  }
};

module.exports = {
  transporter,
  sendQrEmail
};
