const ExcelJS = require('exceljs');
async function test() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.getCell('A1').value = new Date(2011, 0, 15); 
  await workbook.xlsx.writeFile('test_excel_2.xlsx');
  
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile('test_excel_2.xlsx');
  const val = wb2.worksheets[0].getCell('A1').value;
  console.log('Read Date:', val);
  console.log('UTC String:', val.toISOString());
  console.log('getDate():', val.getDate());
  console.log('getUTCDate():', val.getUTCDate());
}
test().catch(console.error);
