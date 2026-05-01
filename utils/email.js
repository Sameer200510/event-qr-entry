const { google } = require('googleapis');

/**
 * Send QR Email to attendee using Gmail HTTP API
 * This bypasses SMTP blocks and connection timeouts entirely.
 */
const sendQrEmail = async (attendee, qrCodeDataUrl, customMessage = '') => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  if (!attendee.email) {
    console.log(`[SKIP_EMAIL] Attendee ${attendee.roll} has no email.`);
    return;
  }

  const htmlContent = `
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

  // Build MIME Message
  const boundary = 'foo_bar_baz';
  const nl = '\n';
  
  const imageData = qrCodeDataUrl.split('base64,')[1];
  
  const str = [
    `To: ${attendee.email}`,
    `Subject: Your QR Access Code for the Event`,
    `Content-Type: multipart/mixed; boundary=${boundary}`,
    nl,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    nl,
    htmlContent,
    nl,
    `--${boundary}`,
    `Content-Type: image/png`,
    `Content-Disposition: attachment; filename="qrcode.png"`,
    `Content-Transfer-Encoding: base64`,
    nl,
    imageData,
    nl,
    `--${boundary}--`
  ].join('\n');

  const encodedMail = Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMail
      }
    });
    console.log(`QR Email sent via Gmail API to ${attendee.email}`);
  } catch (error) {
    console.error(`Failed to send QR Email to ${attendee.email}:`, error.message);
    throw error;
  }
};

module.exports = {
  sendQrEmail
};
