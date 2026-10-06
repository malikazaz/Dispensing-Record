import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, blankEntry } from '../src/model.js';
import { exportPdf } from '../src/pdf.js';
import { readPdf } from './helpers/read-pdf.js';

const record = (id,date,extra={}) => ({...blankEntry(),id,date,number:`000${id}`,name:`Customer ${id}`,types:['SV'],addons:['Elite'],...extra});
test('PDF contains only selected dates, exact headings, Unicode names, pending warnings and period total',async()=>{
  const state=initialState();
  state.entries=[record('before','2026-09-30'),record('first','2026-10-01',{name:'José O’Connor'}),record('pending','2026-10-15',{offers:['2nd pair SV']}),record('last','2026-10-31'),record('after','2026-11-01')];
  const before=structuredClone(state);
  const buffer=await exportPdf(state,{mode:'custom',start:'2026-10-01',end:'2026-10-31',name:'October bonuses'});
  assert.equal(Buffer.from(buffer).subarray(0,5).toString(),'%PDF-');
  const pages=await readPdf(buffer),text=pages.map(p=>p.text).join('\n');
  assert.match(text,/October bonuses/);assert.match(text,/01\/10\/2026 - 31\/10\/2026/);
  assert.match(text,/3 records/);assert.match(text,/Confirmed bonus: €4.00/);assert.match(text,/TOTAL CONFIRMED BONUS\s+€4.00/);
  assert.match(text,/José O’Connor/);assert.match(text,/000first/);assert.match(text,/000last/);assert.match(text,/Pending/);
  assert.doesNotMatch(text,/000before|000after/);assert.match(text,/Date\s+Cust No\s+CX Name\s+SV\s+BIF\s+Vari\s+241\s+Other\s+RE\s+70\s+95\s+130\s+160\s+190\s+240\s+Addons\s+Bonus/);
  assert.doesNotMatch(text,/BONUS KEY|key below/);assert.equal(pages.length,1);assert.deepEqual(state,before);
});
test('long PDF reports repeat headings, preserve every record, number pages and fit text within page bounds',async()=>{
  const state=initialState();state.key.currency='GBP';
  state.entries=Array.from({length:65},(_,i)=>record(String(i).padStart(3,'0'),'2026-10-05',{name:`Zoë Customer ${i} with a longer family name`,addons:['Polaroid','Reaction','Elite']}));
  const pages=await readPdf(await exportPdf(state));
  assert.ok(pages.length>3);
  const all=pages.map(p=>p.text).join('\n');
  for(const entry of state.entries)assert.equal(all.split(entry.number).length-1,1,entry.number);
  assert.match(all,/TOTAL BONUS\s+£455.00/);
  for(const [index,page]of pages.entries()) {
    assert.match(page.text,new RegExp(`Page ${index+1} of ${pages.length}`));
    if(page.text.includes('Zoë Customer'))assert.match(page.text,/Cust No\s+CX Name/);
    const [, , width,height]=page.view;
    assert.ok(width>height,'landscape');
    for(const item of page.items) {
      if(!item.str?.trim())continue;
      const x=item.transform[4],y=item.transform[5];
      assert.ok(x>=20 && x+item.width<=width-20,`horizontal overflow: ${item.str}`);
      assert.ok(y>=15 && y<=height-10,`vertical overflow: ${item.str}`);
    }
  }
});
test('PDF safely prints entered markup as text and validates date ranges',async()=>{
  const state=initialState();state.entries=[record('1','2026-10-05',{name:'<script>alert(1)</script>'})];
  const pages=await readPdf(await exportPdf(state,{mode:'all',name:'<b>My report</b>'}));
  assert.match(pages[0].text,/<b>My report<\/b>/);assert.match(pages[0].text,/<script>alert\(1\)<\/script>/);
  await assert.rejects(exportPdf(state,{mode:'custom',start:'2026-10-31',end:'2026-10-01'}),/on or after/);
});
