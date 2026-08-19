const ExcelJS = require('exceljs');
async function test() {
  const wb = new ExcelJS.Workbook();
  const val = 40558; // Jan 15, 2011 in Excel
  // simulate exceljs reading an Excel date
  // actually let's just make a file with a number and set its format to date
  const sheet = wb.addWorksheet('Sheet1');
  sheet.getCell('A1').value = val;
  sheet.getCell('A1').numFmt = 'dd/mm/yyyy';
  await wb.xlsx.writeFile('test_excel_3.xlsx');
  
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile('test_excel_3.xlsx');
  const readVal = wb2.worksheets[0].getCell('A1').value;
  console.log('Read Date from raw number:', readVal);
  console.log('UTC String:', readVal.toISOString());
  console.log('getDate():', readVal.getDate());
  console.log('getUTCDate():', readVal.getUTCDate());
}
test().catch(console.error);
