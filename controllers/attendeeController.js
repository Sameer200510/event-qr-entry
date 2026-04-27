const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const Attendee = require('../models/Attendee');
const ScanLog = require('../models/ScanLog');
const archiver = require('archiver');
const QRCode = require('qrcode');
const { sendQrEmail } = require('../utils/email');

exports.scanAttendee = async (req, res) => {
  // Helper to log every scan attempt asynchronously (fire & forget)
  const logScan = (data) => {
    ScanLog.create(data).catch(err => console.error('ScanLog error:', err.message));
  };

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const attendee = await Attendee.findOne({ token });

    // Invalid token
    if (!attendee) {
      logScan({ token, success: false, resultCode: 'INVALID_TOKEN', ip, userAgent });
      return res.status(404).json({ error: 'Invalid or unknown QR token.' });
    }

    // ✅ Already verified via OTP - show green success, NOT an error
    if (attendee.status === 'USED' && attendee.entry_method === 'OTP') {
      logScan({
        token,
        attendeeId: attendee._id,
        attendeeName: attendee.name,
        attendeeRoll: attendee.roll,
        success: true,
        resultCode: 'ALREADY_USED_OTP',
        ip,
        userAgent
      });
      return res.status(200).json({
        alreadyVerified: true,
        entry_method: 'OTP',
        message: `${attendee.name} was already verified via OTP.`,
        attendee: { name: attendee.name, roll: attendee.roll, checkedInAt: attendee.checkedInAt }
      });
    }

    // ❌ Already scanned via QR - block
    if (attendee.status === 'USED' && attendee.entry_method === 'QR') {
      logScan({
        token,
        attendeeId: attendee._id,
        attendeeName: attendee.name,
        attendeeRoll: attendee.roll,
        success: false,
        resultCode: 'ALREADY_USED_QR',
        ip,
        userAgent
      });
      return res.status(400).json({
        error: `${attendee.name} has already been scanned in via QR.`,
        attendee: { name: attendee.name, roll: attendee.roll }
      });
    }

    // ✅ First scan - mark as USED via QR (atomic)
    const updated = await Attendee.findOneAndUpdate(
      { _id: attendee._id, status: 'UNUSED' },
      { $set: { status: 'USED', entry_method: 'QR', checkedInAt: new Date() } },
      { new: true }
    );

    if (!updated) {
      // Race condition - someone else scanned between our findOne and findOneAndUpdate
      logScan({ token, success: false, resultCode: 'ALREADY_USED_QR', ip, userAgent });
      return res.status(400).json({ error: 'Attendee was just scanned by another device.' });
    }

    logScan({
      token,
      attendeeId: updated._id,
      attendeeName: updated.name,
      attendeeRoll: updated.roll,
      success: true,
      resultCode: 'ALLOWED',
      ip,
      userAgent
    });

    res.status(200).json({
      message: 'Entry Allowed!',
      attendee: { name: updated.name, roll: updated.roll, checkedInAt: updated.checkedInAt }
    });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: 'Server error during verification.' });
  }
};

exports.parseExcel = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file provided.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read the first row as headers
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Excel sheet is empty.' });
    }

    const headers = rows[0].map(h => typeof h === 'string' ? h.trim() : h).filter(h => h !== '');

    res.json({ headers });
  } catch (error) {
    console.error('Error parsing Excel get-headers:', error);
    res.status(500).json({ error: 'Failed to parse Excel file.' });
  }
};

exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file provided.' });
    }

    if (!req.body.mapping) {
      return res.status(400).json({ error: 'No field mapping provided.' });
    }

    let fieldMapping;
    try {
      fieldMapping = JSON.parse(req.body.mapping);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid field mapping JSON.' });
    }

    const { name: nameField, roll: rollField, email: emailField } = fieldMapping;

    if (!nameField || !rollField) {
      return res.status(400).json({ error: 'Mapping must include "name" and "roll".' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read all rows into objects using top row as keys
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'Excel sheet is empty or only contains headers.' });
    }

    // First pass: extract and validate all rolls
    const allValidRolls = [];
    const parsedData = rawData.map(row => {
      // Find exact mapped keys from the row object
      const name = row[nameField] ? String(row[nameField]).trim() : '';
      const rawRoll = row[rollField] ? String(row[rollField]).trim() : '';
      const roll = rawRoll.toUpperCase();
      const email = emailField && row[emailField] ? String(row[emailField]).trim() : '';

      const record = { originalRow: row, name, roll, email, status: '', create: false };

      if (!name || !roll) {
        record.status = 'Error - Missing required field(s)';
      } else {
        allValidRolls.push(roll);
        record.create = true;
      }
      return record;
    });

    // Check for duplicates in DB in one query
    const existingAttendees = await Attendee.find({ roll: { $in: allValidRolls } }, { roll: 1 });
    const existingRollSet = new Set(existingAttendees.map(a => a.roll.toUpperCase()));

    // Keep track of rolls seen in this specific upload to prevent duplicates within the file itself
    const seenRollsInFile = new Set();
    const newAttendees = [];
    const outputData = [];

    const host = req.protocol + '://' + req.get('host');

    for (const record of parsedData) {
      const outRow = { ...record.originalRow };
      outRow['Token'] = '';
      outRow['QR_Link'] = '';

      if (record.status === '') {
        if (existingRollSet.has(record.roll)) {
          outRow['Status'] = 'Skipped - Duplicate in DB';
        } else if (seenRollsInFile.has(record.roll)) {
          outRow['Status'] = 'Skipped - Duplicate in File';
        } else {
          // Valid new record
          seenRollsInFile.add(record.roll);
          const token = uuidv4();
          const qrLink = `${host}/verify/${token}`;
          
          outRow['Token'] = token;
          outRow['QR_Link'] = qrLink;
          outRow['Status'] = 'Added';

          newAttendees.push({
            name: record.name,
            roll: record.roll,
            email: record.email,
            token,
            qrLink
          });
        }
      } else {
        outRow['Status'] = record.status;
      }

      outputData.push(outRow);
    }

    // Bulk insert new attendees (ordered: false allows it to continue even if some uniquely constrain fail)
    if (newAttendees.length > 0) {
      await Attendee.insertMany(newAttendees, { ordered: false }).catch(err => {
        console.error('Partial failure in insertMany:', err.message);
      });
    }

    // Generate output Excel
    const outSheet = xlsx.utils.json_to_sheet(outputData);
    const outWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(outWorkbook, outSheet, 'Processed');

    const excelBuffer = xlsx.write(outWorkbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="processed_attendees.zip"');
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', function(err) {
      res.status(500).json({ error: 'Archiver error.' });
    });

    archive.pipe(res);

    // Add exactly the Excel file to the root of the ZIP
    archive.append(excelBuffer, { name: 'processed_attendees.xlsx' });

    // Inject generated QR code images inside the 'qrs' folder
    for (const attendee of newAttendees) {
      const qrBuffer = await QRCode.toBuffer(attendee.qrLink, {
        type: 'png',
        margin: 2,
        width: 300
      });
      archive.append(qrBuffer, { name: `qrs/${attendee.roll}.png` });
    }

    await archive.finalize();

  } catch (error) {
    console.error('Error in upload-excel:', error);
    res.status(500).json({ error: 'Failed to process Excel file.' });
  }
};

exports.sendManualEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const attendee = await Attendee.findById(id);
    
    if (!attendee) return res.status(404).json({ error: 'Attendee not found' });
    if (!attendee.email) return res.status(400).json({ error: 'Attendee has no email address' });

    const qrCodeDataUrl = await QRCode.toDataURL(attendee.qrLink);
    await sendQrEmail(attendee, qrCodeDataUrl);

    res.status(200).json({ message: `QR Code sent to ${attendee.email}` });
  } catch (error) {
    console.error('Error sending manual email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
};

exports.sendBulkEmails = async (req, res) => {
  try {
    const attendees = await Attendee.find({ email: { $exists: true, $ne: '' } });
    
    if (attendees.length === 0) {
      return res.status(400).json({ error: 'No attendees with emails found' });
    }

    // Process in background
    res.status(200).json({ message: `Started sending ${attendees.length} emails in the background.` });

    for (const attendee of attendees) {
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(attendee.qrLink);
        await sendQrEmail(attendee, qrCodeDataUrl);
      } catch (err) {
        console.error(`Bulk email failed for ${attendee.roll}:`, err.message);
      }
    }
  } catch (error) {
    console.error('Error in bulk email:', error);
  }
};

exports.getAllAttendees = async (req, res) => {
  try {
    const attendees = await Attendee.find().sort({ createdAt: -1 });
    res.json(attendees);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
};
