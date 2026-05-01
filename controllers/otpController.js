const Attendee = require('../models/Attendee');
const nodemailer = require('nodemailer');
const dns = require('dns');

// Setup generic transport based on .env
const { google } = require('googleapis');

exports.sendOtp = async (req, res) => {
  try {
    const { roll } = req.body;
    if (!roll) {
      return res.status(400).json({ error: 'Roll number is required' });
    }

    const attendee = await Attendee.findOne({ roll });
    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    if (attendee.status === 'USED') {
      return res.status(400).json({ error: 'Attendee has already checked in.' });
    }

    const now = new Date();

    // Enforce 30s cooldown
    if (attendee.otp && attendee.otp.lastSentTime) {
      const timeDiff = now.getTime() - attendee.otp.lastSentTime.getTime();
      if (timeDiff < 30000) {
        return res.status(429).json({ error: 'Please wait 30 seconds before requesting another OTP.' });
      }
    }

    // Enforce max 3 attempts
    const attempts = attendee.otp && attendee.otp.attempts ? attendee.otp.attempts : 0;
    if (attempts >= 3) {
      return res.status(403).json({ error: 'Maximum OTP attempts exceeded for this user.' });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(now.getTime() + 2 * 60 * 1000); // 2 mins

    attendee.otp = {
      code,
      expiry,
      attempts, // preserves attempts count across resends until verified
      lastSentTime: now
    };

    await attendee.save();

    if (!attendee.email) {
      return res.status(400).json({ error: 'Attendee has no email address registered.' });
    }

    // Gmail API Setup
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Build plain text MIME message
    const str = [
      `To: ${attendee.email}`,
      `Subject: Your Event Entry OTP`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      `Your One-Time Password for event entry is: ${code}. It expires in 2 minutes.`
    ].join('\n');

    const encodedMail = Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    try {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMail
        }
      });
      res.status(200).json({ message: 'OTP sent to your email.' });
    } catch (mailErr) {
      console.error("Gmail API Error:", mailErr);
      return res.status(500).json({ 
        error: 'Failed to send OTP via Gmail API. Please check your credentials.',
        details: mailErr.message 
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { roll, otp } = req.body;
    if (!roll || !otp) {
      return res.status(400).json({ error: 'Roll number and OTP are required' });
    }

    const attendee = await Attendee.findOne({ roll });
    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    if (attendee.status === 'USED') {
      return res.status(400).json({ error: 'Attendee has already checked in.' });
    }

    if (!attendee.otp || !attendee.otp.code) {
      return res.status(400).json({ error: 'No OTP requested for this user' });
    }

    if (attendee.otp.attempts >= 3) {
      return res.status(403).json({ error: 'Maximum OTP attempts exceeded' });
    }

    // Validate OTP
    const isExpired = new Date() > attendee.otp.expiry;
    const isCorrect = attendee.otp.code === otp;

    if (isExpired) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (!isCorrect) {
      // Increment attempt count on failure
      attendee.otp.attempts += 1;
      await attendee.save();
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Success! Mark as USED (atomic via standard mongoose save, in larger systems `findOneAndUpdate` with filters is ideal)
    // Let's use atomic update to guarantee no race conditions
    const updatedAttendee = await Attendee.findOneAndUpdate(
      { _id: attendee._id, status: 'UNUSED' }, // strict conditional
      {
        $set: {
          status: 'USED',
          entry_method: 'OTP',
          checkedInAt: new Date()
        },
        $unset: { otp: 1 } // clear OTP
      },
      { new: true }
    );

    if (!updatedAttendee) {
      // If it became null, it means status changed to USED slightly before this query!
      return res.status(400).json({ error: 'Attendee has already checked in' });
    }

    res.status(200).json({
      status: 'ALLOWED',
      name: updatedAttendee.name
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
