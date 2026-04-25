const mongoose = require('mongoose');

/**
 * ScanLog - Audit trail for every QR scan attempt.
 * Logs both successful and failed attempts for security monitoring.
 */
const ScanLogSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    index: true
  },
  attendeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendee',
    default: null
  },
  attendeeName: {
    type: String,
    default: null
  },
  attendeeRoll: {
    type: String,
    default: null
  },
  success: {
    type: Boolean,
    required: true
  },
  // 'ALLOWED' | 'ALREADY_USED_QR' | 'ALREADY_USED_OTP' | 'INVALID_TOKEN' | 'EXPIRED'
  resultCode: {
    type: String,
    required: true
  },
  ip: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: false });

module.exports = mongoose.model('ScanLog', ScanLogSchema);
