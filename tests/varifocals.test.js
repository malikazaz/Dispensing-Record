import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { initialState, blankEntry, calculate, defaultKey, summarise } from '../src/model.js';
import { exportWorkbook } from '../src/workbook.js';
import { exportPdf } from '../src/pdf.js';
import { readPdf } from './helpers/read-pdf.js';

const record = addon => ({...blankEntry(),id:'varifocal',number:'001',name:'Example',types:['Vari','241'],lensSets:{first:{addons:[addon],offers:[]},second:{addons:[addon],offers:[]}}});

test('241 records each varifocal twice but awards only its first-set bonus',()=>{
  for(const [addon,cents] of [['Elite',200],['Tailormade',250],['Supereader',200]]) {
    const entry=record(addon), before=structuredClone(entry), result=calculate(entry,defaultKey());
    assert.equal(result.cents,cents);
    assert.deepEqual(result.parts.find(part=>part.free),{label:`2nd set · ${addon}`,cents:0,free:true});
    assert.deepEqual(entry,before);
    entry.types=['Vari']; assert.equal(calculate(entry,defaultKey()).cents,2*cents);
  }
});

test('index add-ons retain their rates alongside the free second-set varifocal',()=>{
  const entry=record('Supereader');entry.lensSets.first.addons.push('1.74');
  assert.equal(calculate(entry,defaultKey()).cents,700);
  entry.lensSets.second.addons.push('1.74');assert.equal(calculate(entry,defaultKey()).cents,1200);
  entry.types.push('160','190');assert.equal(calculate(entry,defaultKey()).cents,1500);
});

test('flat offers require SV and reject all three second-set varifocals',()=>{
  for(const addon of ['Elite','Tailormade','Supereader']) for(const offer of ['2nd pair SV','2nd-pair add-ons']) {
    const entry=record(addon);entry.types.push('SV');entry.lensSets.second.offers=[offer];
    const result=calculate(entry,defaultKey());
    assert.equal(result.cents,null);assert.ok(result.issues.some(issue=>issue.includes('single vision')));
  }
  const entry=record('Elite');entry.types.push('SV');entry.lensSets.second={addons:['Polaroid'],offers:['2nd-pair add-ons']};
  assert.equal(calculate(entry,defaultKey()).cents,700); // First-set varifocal plus flat second-set SV.
});

test('Golden Ticket counts paid third-pair varifocals but not free 241 second-set varifocals',()=>{
  const entry=record('Tailormade');entry.lensSets.second.offers=['Golden Ticket'];
  assert.equal(calculate(entry,defaultKey()).cents,250);
  entry.lensSets.second.addons.push('1.74');assert.equal(calculate(entry,defaultKey()).cents,850);
  const third={...blankEntry(),types:['Vari','241'],addons:['Tailormade'],offers:['3rd pair half-price combined with 2-4-1','Golden Ticket']};
  assert.equal(calculate(third,defaultKey()).cents,550); // 2.50 paid varifocal + 2 third-pair offer + 1 Golden Ticket.
});

test('free second-set varifocals ignore custom or missing rates, including legacy records',()=>{
  const entry=record('Tailormade'), key=defaultKey();
  key.rates['addons:Tailormade'].first=400;key.rates['addons:Tailormade'].second=null;
  assert.equal(calculate(entry,key).cents,400);
  const legacy={...blankEntry(),id:'legacy',number:'002',name:'Legacy',types:['Vari','241'],set:'second',addons:['Tailormade']};
  assert.equal(calculate(legacy,key).cents,0);
  assert.deepEqual(summarise([entry,legacy],key),{cents:400,pending:0});
});

test('Excel and PDF retain both Tailormades and explain the free second set',async()=>{
  const state=initialState();state.entries=[record('Tailormade')];
  const book=new ExcelJS.Workbook();await book.xlsx.load(await exportWorkbook(state));
  const sheet=book.getWorksheet('Dispensing Record');
  assert.equal(sheet.getCell('Q5').value,2.5);
  assert.match(sheet.getCell('P5').value,/1st set of lenses: Tailormade/);
  assert.match(sheet.getCell('P5').value,/2nd set of lenses: Tailormade \(free under 241\)/);
  const pages=await readPdf(await exportPdf(state));
  assert.match(pages[0].text,/2nd set of lenses: Tailormade \(free under 241\)/);
  assert.match(pages[0].text,/TOTAL BONUS\s+€2.50/);
});
