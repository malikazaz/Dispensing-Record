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

test('custom-period workbook has a separate named section, only selected records and a period-only total',async()=>{
  const state=initialState();state.entries=['2026-09-30','2026-10-01','2026-10-31','2026-11-01'].map((date,i)=>({...blankEntry(),id:`period-${i}`,date,number:`00${i}`,name:`Customer ${i}`,types:['SV'],addons:['Elite']}));
  const book=new ExcelJS.Workbook();await book.xlsx.load(await exportWorkbook(state,{mode:'custom',start:'2026-10-01',end:'2026-10-31',name:'October bonuses'}));
  const sheet=book.getWorksheet('Bonus period');assert.equal(sheet.getCell('A1').value,'October bonuses');assert.match(sheet.getCell('A3').value,/01\/10\/2026 – 31\/10\/2026/);
  assert.deepEqual(sheet.getRow(4).values.slice(1),PAPER_HEADERS);assert.equal(sheet.getCell('B5').value,'001');assert.equal(sheet.getCell('B6').value,'002');
  assert.deepEqual(sheet.getCell('Q7').value,{formula:'SUM(Q5:Q6)',result:4});assert.match(sheet.getCell('A2').value,/2 records/);
  assert.equal(sheet.autoFilter,'A4:Q6');assert.equal(state.entries.length,4);
});
