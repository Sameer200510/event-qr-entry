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

  // Use the custom message from admin, or nothing if empty
  const messageHtml = customMessage 
    ? `<div style="background-color: #EEF2FF; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 5px solid #4F46E5; color: #3730A3; font-size: 16px; line-height: 1.6;">${customMessage}</div>` 
    : '';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #111827; margin: 0; font-size: 24px; font-weight: 800;">Hello, ${attendee.name}!</h2>
      </div>
      
      ${messageHtml}
      
      <div style="text-align: center; margin: 40px 0; background: #f9fafb; padding: 30px; border-radius: 16px; border: 2px dashed #e5e7eb;">
        <img src="cid:qrcode" alt="QR Code" style="width: 220px; height: 220px; display: block; margin: 0 auto;" />
        <p style="margin-top: 15px; font-size: 14px; color: #6b7280; font-weight: 600;">Scan this at the entry gate</p>
      </div>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Your Personal Access Link</p>
        <p style="margin: 8px 0 0 0; word-break: break-all; font-size: 14px;"><a href="${attendee.qrLink}" style="color: #4F46E5; text-decoration: none; font-weight: 600;">${attendee.qrLink}</a></p>
      </div>

      <div style="text-align: center; border-top: 1px solid #eee; padding-top: 25px;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; ${new Date().getFullYear()} Event Management Team</p>
      </div>
    </div>
  `;

  // Build MIME Message with Inline Attachment
  const boundary = 'custom_boundary_qr_event';
  const nl = '\n';
  const imageData = qrCodeDataUrl.split('base64,')[1];
  
  const str = [
    `To: ${attendee.email}`,
    `Subject: Your Event Entry Access Code`,
    `Content-Type: multipart/related; boundary=${boundary}`,
    nl,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    nl,
    htmlContent,
    nl,
    `--${boundary}`,
    `Content-Type: image/png`,
    `Content-Transfer-Encoding: base64`,
    `Content-ID: <qrcode>`,
    `Content-Disposition: inline; filename="qrcode.png"`,
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
    console.log(`Tidy QR Email sent via Gmail API to ${attendee.email}`);
  } catch (error) {
    console.error(`Failed to send QR Email to ${attendee.email}:`, error.message);
    throw error;
  }
};

module.exports = {
  sendQrEmail
};
