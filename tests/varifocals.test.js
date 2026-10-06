import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { initialState, blankEntry, calculate, defaultKey, summarise } from '../src/model.js';
import { exportWorkbook } from '../src/workbook.js';
import { exportPdf } from '../src/pdf.js';
import { readPdf } from './helpers/read-pdf.js';

const record = addon => ({...blankEntry(),id:'varifocal',number:'001',name:'Example',types:['Vari','241'],lensSets:{first:{addons:[addon],offers:[]},second:{addons:[addon],offers:[]}}});

test('241 records Elite and Tailormade twice but awards only their first-set bonus',()=>{
  for(const [addon,cents] of [['Elite',200],['Tailormade',250]]) {
    const entry=record(addon), before=structuredClone(entry), result=calculate(entry,defaultKey());
    assert.equal(result.cents,cents);
    assert.deepEqual(result.parts.find(part=>part.free),{label:`2nd set · ${addon}`,cents:0,free:true});
    assert.deepEqual(entry,before);
    entry.types=['Vari']; assert.equal(calculate(entry,defaultKey()).cents,2*cents);
  }
});

test('index add-ons retain their rates alongside the free second-set varifocal',()=>{
  const entry=record('Elite');entry.lensSets.first.addons.push('1.74');
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


test('free second-set Supereader pays included UCSC once, or only the chosen index rate',()=>{
  const key=defaultKey();
  for(const [index,cents] of [[null,200],['1.6',350],['1.67',400],['1.74',500]]) {
    for(const explicitUcsc of [false,true]) {
      const addons=['Supereader',...(index?[index]:[]),...(explicitUcsc?['UCSC']:[])];
      const legacy={...blankEntry(),types:['Vari','241'],set:'second',addons};
      const before=structuredClone(legacy),result=calculate(legacy,key);
      assert.equal(result.cents,cents);
      assert.deepEqual(result.parts.find(part=>part.free),{label:'Supereader',cents:0,free:true});
      assert.equal(result.parts.some(part=>part.label.startsWith('UCSC')),!index);
      assert.deepEqual(legacy,before);
      const paired=record('Supereader');paired.lensSets.second.addons=addons;
      assert.equal(calculate(paired,key).cents,200+cents);
      paired.lensSets.first.addons.push('1.74');paired.types.push('160','190');
      assert.equal(calculate(paired,key).cents,1000+cents); // First set 7 + highest frame 3.
      legacy.offers=['Golden Ticket'];
      assert.equal(calculate(legacy,key).cents,cents+100); // One paid coating or index, not the free design.
    }
  }
});

test('free Supereader follows the coating/index key and ignores its free design rate',()=>{
  const entry={...blankEntry(),types:['Vari','241'],set:'second',addons:['Supereader']};
  const key=defaultKey();key.rates['addons:Supereader'].second=null;
  key.rates['addons:UCSC'].second=275;assert.equal(calculate(entry,key).cents,275);
  key.rates['addons:UCSC'].second=null;assert.equal(calculate(entry,key).cents,null);
  entry.addons.push('1.6');key.rates['addons:1.6'].second=450;
  assert.equal(calculate(entry,key).cents,450);
  key.rates['addons:1.6'].second=null;assert.equal(calculate(entry,key).cents,null);
});

test('paid Supereader outside the free second-set 241 offer keeps its own rate',()=>{
  const key=defaultKey();key.rates['addons:Supereader'].second=325;
  const entry={...blankEntry(),types:['Vari'],set:'second',addons:['Supereader','1.6']};
  assert.equal(calculate(entry,key).cents,675);
  entry.set='first';entry.types.push('241');assert.equal(calculate(entry,key).cents,500);
});

test('Excel and PDF record free Supereader with included UCSC or the paid index',async()=>{
  const state=initialState();
  const coated=record('Supereader');
  const upgraded={...record('Supereader'),id:'upgraded'};upgraded.lensSets.second.addons.push('UCSC','1.6');
  state.entries=[coated,upgraded];
  const book=new ExcelJS.Workbook();await book.xlsx.load(await exportWorkbook(state));
  const sheet=book.getWorksheet('Dispensing Record');
  assert.equal(sheet.getCell('Q5').value,4);assert.equal(sheet.getCell('Q6').value,5.5);
  assert.match(sheet.getCell('P5').value,/Supereader \(free under 241; includes UCSC\)/);
  assert.match(sheet.getCell('P6').value,/UCSC \(included in index upgrade\)/);
  assert.match(sheet.getCell('P6').value,/1.6/);
  const pages=await readPdf(await exportPdf(state));
  assert.match(pages[0].text,/TOTAL BONUS\s+€9.50/);
  assert.match(pages[0].text,/Supereader \(free under 241; includes UCSC\)/);
  assert.match(pages[0].text,/UCSC \(included in index upgrade\)/);
});
