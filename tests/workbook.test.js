import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { initialState,blankEntry } from '../src/model.js';
import { exportWorkbook,PAPER_HEADERS } from '../src/workbook.js';

test('Excel round trip preserves exact headings, text IDs, dates, numeric bonuses, formats and totals',async()=>{
  const state=initialState();state.entries=[{...blankEntry(),id:'test',date:'2026-10-05',number:'001234',name:'=HYPERLINK("bad")',types:['SV','160'],addons:['Polaroid','Elite']}];
  const buffer=await exportWorkbook(state),book=new ExcelJS.Workbook();await book.xlsx.load(buffer);
  const sheet=book.getWorksheet('Dispensing Record');assert.deepEqual(sheet.getRow(4).values.slice(1),PAPER_HEADERS);
  assert.equal(sheet.getCell('A5').value.toISOString().slice(0,10),'2026-10-05');
  assert.equal(sheet.getCell('B5').value,'001234');assert.equal(sheet.getCell('C5').type,ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('D5').value,'✓');assert.equal(sheet.getCell('M5').value,'✓');
  assert.match(sheet.getCell('P5').value,/1st set of lenses/);assert.match(sheet.getCell('P5').value,/Polaroid \+ Elite/);
  assert.equal(sheet.getCell('Q5').value,6.5);assert.match(sheet.getCell('Q5').numFmt,/€/);
  assert.deepEqual(sheet.getCell('Q6').value,{formula:'SUM(Q5:Q5)',result:6.5});
  assert.equal(sheet.views[0].ySplit,4);assert.equal(sheet.pageSetup.orientation,'landscape');
  assert.ok(book.getWorksheet('Bonus key'));assert.ok(sheet.getCell('Q5').font.bold);
});
test('pending rows export explicitly and do not poison confirmed total',async()=>{
  const state=initialState();state.entries=[{...blankEntry(),id:'1',date:'2026-10-05',number:'1',name:'A',types:['SV'],offers:['2nd pair SV']},{...blankEntry(),id:'2',date:'2026-10-05',number:'2',name:'B',types:['SV'],addons:['Elite']}];
  const book=new ExcelJS.Workbook();await book.xlsx.load(await exportWorkbook(state));
  const sheet=book.getWorksheet('Dispensing Record');assert.equal(sheet.getCell('Q5').value,'Pending');assert.equal(sheet.getCell('Q7').value.result,2);
  assert.match(sheet.getCell('A2').value,/1 pending/);assert.match(sheet.getCell('P5').value,/REVIEW/);
});
test('empty workbook has a valid zero total without a circular formula',async()=>{
  const book=new ExcelJS.Workbook();await book.xlsx.load(await exportWorkbook(initialState()));assert.equal(book.getWorksheet('Dispensing Record').getCell('Q5').value,0);
});
