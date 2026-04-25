const express = require('express');
const multer = require('multer');
const attendeeController = require('../controllers/attendeeController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Routes - Protected by role
router.post('/parse-excel', protect, authorize('Admin'), upload.single('file'), attendeeController.parseExcel);
router.post('/upload-excel', protect, authorize('Admin'), upload.single('file'), attendeeController.uploadExcel);
router.post('/scan', protect, authorize('Admin', 'Volunteer'), attendeeController.scanAttendee);

module.exports = router;
