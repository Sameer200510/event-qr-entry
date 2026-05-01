const mongoose = require('mongoose');

const AttendeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  roll: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  qrLink: {
    type: String,
    required: true,
  },
  entryStatus: {
    type: Boolean,
    default: false,
  },
  foodStatus: {
    type: Boolean,
    default: false,
  },
  entryScannedAt: {
    type: Date,
  },
  foodScannedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['UNUSED', 'USED'],
    default: 'UNUSED'
  },
  entry_method: {
    type: String,
    enum: ['QR', 'OTP']
  },
  checkedInAt: {
    type: Date
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  otp: {
    code: String,
    expiry: Date,
    attempts: { type: Number, default: 0 },
    lastSentTime: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Attendee', AttendeeSchema);
