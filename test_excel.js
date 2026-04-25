const xlsx = require('xlsx');
const fs = require('fs');

async function runTest() {
  // 1. Create a dynamic excel file
  const data = [
    { "Student Name": "John Doe", "Roll Number": "101", "Email Address": "john@ex.com" },
    { "Student Name": "Jane Doe", "Roll Number": "102", "Email Address": "jane@ex.com" },
    { "Student Name": "Duplicate John", "Roll Number": "101", "Email Address": "dup@ex.com" }, // dup in file
    { "Student Name": "Invalid", "Email Address": "no-roll@ex.com" }, // missing roll
  ];

  const sheet = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, sheet, "Sheet1");
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync('test_upload.xlsx', buffer);
  
  console.log("Created test excel file.");
}

runTest();
