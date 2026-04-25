const express = require('express');
const { sendOtp, verifyOtp } = require('../controllers/otpController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/send', protect, authorize('Admin', 'Volunteer'), sendOtp);
router.post('/verify', protect, authorize('Admin', 'Volunteer'), verifyOtp);

module.exports = router;
