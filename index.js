require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const attendeeRoutes = require('./routes/attendeeRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Rate Limiters
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // max 60 scan requests per minute per IP
  message: { error: 'Too many scan requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // max 10 OTP requests per minute per IP
  message: { error: 'Too many OTP requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/attendees/scan', scanLimiter); // Rate limit only the scan endpoint
app.use('/api/attendees', require('./routes/attendeeRoutes'));
app.use('/api/otp/send', otpLimiter);        // Rate limit OTP send endpoint
app.use('/api/otp', require('./routes/otpRoutes'));

// Public QR Code Scan Endpoint (When someone scans with normal phone camera)
app.get('/verify/:token', async (req, res) => {
  try {
    const Attendee = require('./models/Attendee');
    const token = req.params.token;

    // Just fetch the attendee details, DO NOT update status
    const attendee = await Attendee.findOne({ token: token });

    if (!attendee) {
      return res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h1 style="color: #ef4444;">❌ Invalid QR Code</h1>
          <p>This token does not exist in our system.</p>
        </div>
      `);
    }

    // Check current status for display purposes only
    const isAlreadyUsed = attendee.status === 'USED';

    // Success - Show instruction message instead of allowing entry
    res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px; background: white; max-width: 500px; margin-left: auto; margin-right: auto; padding: 40px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px;">
          <div style="width: 80px; height: 80px; background: #fff7ed; border-radius: 40px; display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 2px solid #fbbf24;">
            <span style="font-size: 40px;">⚠️</span>
          </div>
        </div>
        
        <h1 style="color: #1f2937; margin-bottom: 12px; font-size: 24px; font-weight: 800;">Official Scanner Required</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          This QR code must be scanned through the <strong>Official Entry Platform</strong> by an authorized volunteer.
        </p>

        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; text-align: left; margin-bottom: 24px; border: 1px solid #f3f4f6;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Attendee Details</p>
          <p style="margin: 4px 0 0; color: #111827; font-size: 18px; font-weight: 700;">${attendee.name}</p>
          <p style="margin: 2px 0 0; color: #6b7280; font-size: 14px;">Roll No: ${attendee.roll}</p>
          ${isAlreadyUsed ? '<p style="margin: 8px 0 0; color: #f97316; font-size: 13px; font-weight: 600;">⚠️ Status: Already Checked In</p>' : '<p style="margin: 8px 0 0; color: #10b981; font-size: 13px; font-weight: 600;">✅ Status: Valid Ticket</p>'}
        </div>

        <p style="color: #9ca3af; font-size: 13px;">External scanners cannot process entry counts.</p>
      </div>
      <style>
        body { background-color: #f3f4f6; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      </style>
    `);
  } catch (err) {
    res.status(500).send('<h2>Server error during verification.</h2>');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
