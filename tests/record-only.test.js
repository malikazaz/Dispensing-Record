import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { initialState, blankEntry, defaultKey, calculate, validateState, GROUPS } from '../src/model.js';
import { exportWorkbook } from '../src/workbook.js';
import { exportPdf } from '../src/pdf.js';
import { readPdf } from './helpers/read-pdf.js';

test('Super Boost follows Supereader and adds no bonus with existing keys in either set',()=>{
  assert.equal(GROUPS.addons[GROUPS.addons.indexOf('Supereader')+1],'Super Boost');
  const key=defaultKey();assert.equal(key.rates['addons:Super Boost'],undefined);
  for(const set of ['first','second']) {
    const entry={...blankEntry(),id:'boost',number:'001',name:'Example',types:['SV'],set,addons:['Super Boost']};
    assert.equal(calculate(entry,key).cents,0);
    const state={...initialState(),entries:[entry],key};assert.equal(validateState(state),state);
  }
});

test('Super Boost does not trigger flat offers or increase Golden Ticket counts',()=>{
  const key=defaultKey();
  const entry={...blankEntry(),types:['SV'],set:'second',addons:['Super Boost'],offers:['2nd pair SV']};
  assert.equal(calculate(entry,key).cents,300);
  entry.addons.push('Tint');assert.equal(calculate(entry,key).cents,500);
  entry.offers=['Golden Ticket'];assert.equal(calculate(entry,key).cents,200);
  entry.addons=['Super Boost'];assert.equal(calculate(entry,key).cents,null);
  entry.offers=['2nd-pair add-ons'];assert.equal(calculate(entry,key).cents,null);
});

test('both record-only selections export to Excel and PDF without changing the bonus',async()=>{
  const state=initialState();state.entries=[{...blankEntry(),id:'boost',number:'001',name:'Example',types:['SV'],lensSets:{first:{addons:['UCSC','Super Boost'],offers:[]},second:{addons:['Super Boost'],offers:[]}}}];
  const book=new ExcelJS.Workbook();await book.xlsx.load(await exportWorkbook(state));
  const sheet=book.getWorksheet('Dispensing Record');assert.equal(sheet.getCell('Q5').value,1.5);
  assert.equal(sheet.getCell('P5').value.match(/Super Boost/g).length,2);
  const pages=await readPdf(await exportPdf(state));assert.equal(pages[0].text.match(/Super Boost/g).length,2);
  assert.match(pages[0].text,/TOTAL BONUS\s+€1.50/);
});
