const ExcelJS = require('exceljs');
async function test() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.getCell('A1').value = new Date(2011, 0, 14); // Jan 14, 2011 local time
  console.log('Value inserted:', sheet.getCell('A1').value);
  await workbook.xlsx.writeFile('test_excel.xlsx');
  
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile('test_excel.xlsx');
  const val = wb2.worksheets[0].getCell('A1').value;
  console.log('Value read:', val, val.toISOString(), val.getDate());
}
test().catch(console.error);
