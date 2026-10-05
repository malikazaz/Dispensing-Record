import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, blankEntry } from '../src/model.js';
import { selectExport, monthPeriod, exportFilename } from '../src/export-selection.js';

const fixture=()=>({...initialState(),entries:['2026-09-30','2026-10-01','2026-10-31','2026-11-01'].map((date,i)=>({...blankEntry(),id:`test-${i}`,number:`00${i}`,name:`Customer ${i}`,date,types:['SV'],addons:['Elite']}))});
test('period includes both boundaries, excludes outside records and leaves stored data untouched',()=>{
  const state=fixture(),before=structuredClone(state);
  const selection=selectExport(state,{mode:'custom',start:'2026-10-01',end:'2026-10-31',name:' October bonuses '});
  assert.deepEqual(selection.entries.map(e=>e.date),['2026-10-01','2026-10-31']);assert.deepEqual(selection.total,{cents:400,pending:0});
  assert.equal(selection.name,'October bonuses');assert.deepEqual(state,before);
  assert.equal(exportFilename(selection),'dispensing-record-2026-10-01-to-2026-10-31.xlsx');
});
test('all records ignores stray date values; a single-day period and no matches are supported',()=>{
  assert.equal(selectExport(fixture(),{mode:'all',start:'bad',end:''}).entries.length,4);
  assert.equal(selectExport(fixture(),{mode:'custom',start:'2026-10-01',end:'2026-10-01'}).entries.length,1);
  assert.deepEqual(selectExport(fixture(),{mode:'custom',start:'2026-01-01',end:'2026-01-31'}).total,{cents:0,pending:0});
});
test('reversed, missing and impossible calendar dates are rejected',()=>{
  for(const [start,end]of [['2026-10-31','2026-10-01'],['','2026-10-01'],['2026-02-30','2026-03-31']])assert.throws(()=>selectExport(fixture(),{mode:'custom',start,end}));
  assert.throws(()=>selectExport(fixture(),{mode:'invalid'}));
});
test('month shortcuts handle leap years and January rollover without timezone conversion',()=>{
  assert.deepEqual(monthPeriod('month','2028-02-20'),{start:'2028-02-01',end:'2028-02-29'});
  assert.deepEqual(monthPeriod('month','2100-02-20'),{start:'2100-02-01',end:'2100-02-28'});
  assert.deepEqual(monthPeriod('previous-month','2026-01-01'),{start:'2025-12-01',end:'2025-12-31'});
  assert.deepEqual(monthPeriod('previous-month','2026-03-31'),{start:'2026-02-01',end:'2026-02-28'});
});
