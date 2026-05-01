const Attendee = require('../models/Attendee');
const nodemailer = require('nodemailer');
const dns = require('dns');

// Setup generic transport based on .env
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  connectionTimeout: 20000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  family: 4
});

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

    // Send email (we don't await blocking it if possible, but simpler to await for UI loading state)
    // In dev, if dummy is set, it will fail if not using Ethereal, so we catch error but don't crash
    // Send email
    if (!process.env.SMTP_USER) {
      console.log(`[NO_SMTP_ENV] OTP for ${attendee.email || roll} is: ${code}`);
      return res.status(200).json({ 
        message: 'OTP generated (Console Only)', 
        debug: 'SMTP_USER is not set in .env' 
      });
    } 

    if (!attendee.email) {
      return res.status(400).json({ error: 'Attendee has no email address registered.' });
    }

    try {
      await transporter.sendMail({
        from: `"Event Team" <${process.env.SMTP_USER}>`,
        to: attendee.email,
        subject: 'Your Event Entry OTP',
        text: `Your One-Time Password for event entry is: ${code}. It expires in 2 minutes.`
      });
      res.status(200).json({ message: 'OTP sent to your email.' });
    } catch (mailErr) {
      console.error("Email send error:", mailErr);
      return res.status(500).json({ 
        error: 'Failed to send email. Please check server logs or SMTP config.',
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
