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

    // Check atomic update to prevent double-scanning
    const updatedAttendee = await Attendee.findOneAndUpdate(
      { token: token, status: 'UNUSED' },
      {
        $set: {
          status: 'USED',
          entry_method: 'QR',
          checkedInAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedAttendee) {
      // It's either invalid or already used
      const existing = await Attendee.findOne({ token: token });
      if (!existing) {
        return res.status(404).send(`
          <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h1 style="color: #ef4444;">❌ Invalid QR Code</h1>
            <p>This token does not exist in our system.</p>
          </div>
        `);
      } else {
        return res.status(400).send(`
          <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h1 style="color: #f97316;">⚠️ Already Scanned!</h1>
            <p><strong>${existing.name}</strong> (${existing.roll}) has already been checked in.</p>
          </div>
        `);
      }
    }

    // Success
    res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px; background-color: #f0fdf4; padding: 40px; border-radius: 12px; display: inline-block;">
        <h1 style="color: #22c55e; margin-bottom: 10px;">✅ Entry Allowed!</h1>
        <h2 style="color: #1f2937; margin: 0;">${updatedAttendee.name}</h2>
        <p style="color: #4b5563; font-size: 18px;">Roll No: ${updatedAttendee.roll}</p>
        <p style="color: #9ca3af; font-size: 14px;">Checked in securely.</p>
      </div>
      <style>body { text-align: center; background-color: #f9fafb; }</style>
    `);
  } catch (err) {
    res.status(500).send('<h2>Server error during verification.</h2>');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
