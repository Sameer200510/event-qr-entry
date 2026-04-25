const fs = require('fs');

async function runClientTest() {
  try {
    // Test 1: parse-excel
    console.log("Testing /api/attendees/parse-excel...");
    const formData = new FormData();
    const fileBuffer = fs.readFileSync('test_upload.xlsx');
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'test_upload.xlsx');

    const parseRes = await fetch('http://localhost:5000/api/attendees/parse-excel', {
      method: 'POST',
      body: formData
    });
    
    if (!parseRes.ok) {
      const text = await parseRes.text();
      throw new Error(`Parse Failed: ${text}`);
    }
    const parseData = await parseRes.json();
    console.log("Headers from Excel:", parseData.headers);

    // Test 2: upload-excel
    console.log("Testing /api/attendees/upload-excel...");
    const uploadFormData = new FormData();
    uploadFormData.append('file', blob, 'test_upload.xlsx');
    uploadFormData.append('mapping', JSON.stringify({
      "name": "Student Name",
      "roll": "Roll Number",
      "email": "Email Address"
    }));

    const uploadRes = await fetch('http://localhost:5000/api/attendees/upload-excel', {
      method: 'POST',
      body: uploadFormData
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Upload Failed: ${text}`);
    }
    const excelOutBuffer = await uploadRes.arrayBuffer();
    fs.writeFileSync('result_attendees.xlsx', Buffer.from(excelOutBuffer));
    console.log("Successfully wrote result_attendees.xlsx, size:", excelOutBuffer.byteLength);

  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

runClientTest();
