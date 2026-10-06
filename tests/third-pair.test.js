import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { blankEntry, defaultKey, calculate, initialState, validateEntry, validateState, GROUPS } from '../src/model.js';
import { saveState, loadState } from '../src/storage.js';
import { documentOf, mergeDocuments } from '../src/cloud-model.js';
import { exportWorkbook } from '../src/workbook.js';
import { exportPdf } from '../src/pdf.js';
import { readPdf } from './helpers/read-pdf.js';

const record=()=>({...blankEntry(),id:'third',date:'2026-10-06',number:'001',name:'Example customer',types:['241','160','190'],lensSets:{first:{addons:['UCSC'],offers:[]},second:{addons:['UCSC'],offers:[]}},thirdPair:{enabled:true,addons:['Tailormade','1.74','Polaroid 1.6']}});

test('each third-pair choice earns one euro, including Super Boost',()=>{
  for (const addon of GROUPS.addons) {
    const entry=record();entry.thirdPair.addons=[addon];
    const result=calculate(entry,defaultKey());
    assert.equal(result.cents,750);
    assert.equal(result.parts.filter(part=>part.label.startsWith('3rd pair')).length,1);
  }
  const entry=record(),before=structuredClone(entry);assert.equal(calculate(entry,defaultKey()).cents,950);
  assert.deepEqual(entry,before);
  entry.types.push('SV');entry.lensSets.second={addons:['Tint'],offers:['2nd pair SV']};
  assert.equal(calculate(entry,defaultKey()).cents,1250); // 3 frames + 1.5 first + 5 second + 3 third.
  entry.thirdPair={enabled:false,addons:[]};assert.equal(calculate(entry,defaultKey()).cents,950);
});

test('third-pair key defaults support old backups, custom rates and missing-rate review',()=>{
  const entry=record(),key=defaultKey();delete key.thirdPairRate;
  assert.equal(calculate(entry,key).cents,950);
  key.rates['offers:Golden Ticket'].first=900;key.rates['offers:3rd pair half-price combined with 2-4-1'].first=900;
  assert.equal(calculate(entry,key).cents,950);
  key.thirdPairRate=150;assert.equal(calculate(entry,key).cents,1100);
  key.thirdPairRate=null;assert.equal(calculate(entry,key).cents,null);
  key.thirdPairRate=100;entry.thirdPair.addons=[];assert.equal(calculate(entry,key).cents,null);
});

test('third-pair choices survive storage, backup and cloud merge with validation',()=>{
  const state=initialState();state.entries=[record()];let raw=null;
  saveState({getItem:()=>raw,setItem:(_,next)=>{raw=next;}},state,null);
  const backup=JSON.parse(JSON.stringify(documentOf(loadState({getItem:()=>raw}).state)));
  assert.deepEqual(backup.entries,state.entries);
  assert.deepEqual(mergeDocuments(initialState(),backup,initialState()).document.entries,state.entries);
  for(const thirdPair of [null,{}, {enabled:'yes',addons:[]},{enabled:true,addons:['unknown']},{enabled:true,addons:['Tint','Tint']},{enabled:false,addons:['Tint']}]) assert.throws(()=>validateEntry({...record(),thirdPair}));
  for(const rate of [-1,1.5,'100',1000001]) assert.throws(()=>validateState({...state,key:{...state.key,thirdPairRate:rate}}));
});

test('third-pair labels and exact amounts appear in Excel and PDF',async()=>{
  const state=initialState();state.entries=[record()];
  const book=new ExcelJS.Workbook();await book.xlsx.load(await exportWorkbook(state));
  const sheet=book.getWorksheet('Dispensing Record');
  assert.equal(sheet.getCell('Q5').value,9.5);
  assert.match(sheet.getCell('P5').value,/3rd pair \(Golden Ticket \/ half price\): Tailormade \+ 1.74 \+ Polaroid 1.6/);
  const pages=await readPdf(await exportPdf(state));
  assert.match(pages[0].text,/3rd pair \(Golden Ticket \/ half price\)/);
  assert.match(pages[0].text,/TOTAL BONUS\s+€9.50/);
});
