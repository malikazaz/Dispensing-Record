import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { blankEntry, calculate, defaultKey, initialState, lensSetsOf, validateEntry } from '../src/model.js';
import { loadState, saveState } from '../src/storage.js';
import { documentOf, mergeDocuments } from '../src/cloud-model.js';
import { exportWorkbook } from '../src/workbook.js';
import { exportPdf } from '../src/pdf.js';
import { readPdf } from './helpers/read-pdf.js';

const record = () => ({...blankEntry(),id:'pair',number:'001',name:'Both lenses',types:['241','160','190'],lensSets:{first:{addons:['UCSC'],offers:[]},second:{addons:['UCSC'],offers:[]}}});

test('both lens sets use their own rates with one 241 frame bonus',()=>{
  const entry=record(), key=defaultKey();
  assert.equal(calculate(entry,key).cents,650);
  entry.set='second'; assert.equal(calculate(entry,key).cents,650);
  entry.lensSets.first.addons=['1.6']; entry.lensSets.second.addons=['1.6'];
  assert.equal(calculate(entry,key).cents,950);
  key.rates['addons:1.6'].second=400;
  assert.equal(calculate(entry,key).cents,1000);
});

test('second-pair flat and third-pair bonuses remain independent',()=>{
  const entry=record();entry.types.push('SV');
  entry.lensSets.second={addons:['Polaroid','Tint'],offers:['2nd pair SV']};
  entry.thirdPair={enabled:true,addons:['Polaroid','Tailormade']};
  assert.equal(calculate(entry,defaultKey()).cents,1350); // 3 frame + 1.50 first + 5 flat + 2 base + 2 Golden Ticket
  entry.thirdPair={enabled:false,addons:[]};
  entry.lensSets.second={addons:[],offers:['2nd pair SV']};
  assert.equal(calculate(entry,defaultKey()).cents,750);
});

test('legacy single-set records keep their original selection and bonus',()=>{
  const entry={...blankEntry(),id:'old',number:'001',name:'Old second set',set:'second',types:['SV','190'],addons:['UCSC'],offers:['2nd pair SV']};
  assert.equal(calculate(entry,defaultKey()).cents,500);
  const sets=lensSetsOf(entry);assert.deepEqual(sets.first,{addons:[],offers:[]});assert.deepEqual(sets.second,{addons:['UCSC'],offers:['2nd pair SV']});
  sets.second.addons.push('Elite');assert.deepEqual(entry.addons,['UCSC']);
});

test('paired selections validate and survive storage, backup and cloud document merging',()=>{
  const state=initialState();state.entries=[record()];
  let raw=null;const storage={getItem:()=>raw,setItem:(_,value)=>{raw=value;}};
  saveState(storage,state,null);
  const backup=JSON.parse(JSON.stringify(documentOf(loadState(storage).state)));
  assert.deepEqual(backup.entries,state.entries);
  assert.deepEqual(mergeDocuments(initialState(),backup,initialState()).document.entries,state.entries);
  for(const broken of [null,{}, {first:{addons:['Unknown'],offers:[]},second:{addons:[],offers:[]}}, {first:{addons:[],offers:[]},second:{addons:['UCSC','UCSC'],offers:[]}}]) assert.throws(()=>validateEntry({...record(),lensSets:broken}));
});

test('Excel and PDF include both sets and the combined 6.50 bonus',async()=>{
  const state=initialState();state.entries=[record()];
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await exportWorkbook(state));
  const sheet=workbook.getWorksheet('Dispensing Record');
  assert.equal(sheet.getCell('Q5').value,6.5);
  assert.match(sheet.getCell('P5').value,/1st set of lenses: UCSC/);
  assert.match(sheet.getCell('P5').value,/2nd set of lenses: UCSC/);
  const pages=await readPdf(await exportPdf(state));
  assert.match(pages[0].text,/1st set of lenses: UCSC/);assert.match(pages[0].text,/2nd set of lenses: UCSC/);
  assert.match(pages[0].text,/TOTAL BONUS\s+€6.50/);
});
