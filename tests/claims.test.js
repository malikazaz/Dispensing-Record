import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { initialState, blankEntry, validateState } from '../src/model.js';
import { createClaim, changeClaimStatus, claimsOf, unclaimedEntries, duplicateReceipts, recordBonus } from '../src/claims.js';
import { documentOf, mergeDocuments, CloudSync } from '../src/cloud-model.js';
import { saveState, loadState } from '../src/storage.js';
import { selectExport } from '../src/export-selection.js';
import { exportWorkbook } from '../src/workbook.js';
import { exportPdf } from '../src/pdf.js';
import { readPdf } from './helpers/read-pdf.js';
const entry=(id,date)=>({...blankEntry(),id,date,number:id,name:'Example '+id,types:['SV'],addons:['Elite']});
const sample=()=>({...initialState(),entries:[entry('sept-a','2026-09-10'),entry('sept-b','2026-09-20'),entry('oct','2026-10-02')]});
test('September leftovers enter October claims while previously claimed receipts remain excluded',()=>{
 let state=createClaim(sample(),'September',['sept-a']);const first=claimsOf(state)[0];
 assert.deepEqual(unclaimedEntries(state).map(e=>e.id),['sept-b','oct']);
 state=changeClaimStatus(state,first.id,'submitted');
 state=createClaim(state,'October',['sept-b','oct']);validateState(state);
 assert.equal(claimsOf(state)[1].total,400);assert.equal(unclaimedEntries(state).length,0);
 assert.equal(selectExport(state,{mode:'all'}).entries.length,0);
 assert.throws(()=>createClaim(state,'Duplicate',['sept-a']),/no longer available/);
 assert.throws(()=>changeClaimStatus(state,first.id,'submitted'),/changed/);
});
test('claims freeze details and amounts across key and currency changes in both exports',async()=>{
 let state=createClaim(sample(),'September claim',['sept-a']);const claim=claimsOf(state)[0];
 state=changeClaimStatus(state,claim.id,'submitted');state.key.rates['addons:Elite'].first=900;state.key.currency='GBP';
 validateState(state);assert.equal(recordBonus(state,state.entries[0]).cents,200);assert.equal(recordBonus(state,state.entries[1]).cents,900);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await exportWorkbook(state,{claimId:claim.id}));
 assert.equal(book.worksheets.length,1);assert.equal(book.worksheets[0].getCell('Q5').value,2);assert.match(book.worksheets[0].getCell('Q5').numFmt,/€/);
 const pages=await readPdf(await exportPdf(state,{claimId:claim.id}));assert.equal(pages.length,1);assert.match(pages[0].text,/September claim/);assert.match(pages[0].text,/TOTAL BONUS\s+€2.00/);assert.doesNotMatch(pages[0].text,/Example sept-b|£/);
});
test('claim validation blocks edited, deleted and double-reserved records; release preserves history',()=>{
 const draft=createClaim(sample(),'September',['sept-a']);const id=claimsOf(draft)[0].id;
 const edited=structuredClone(draft);edited.entries[0].name='Changed';assert.throws(()=>validateState(edited),/claimed record changed/);
 const deleted=structuredClone(draft);deleted.entries.shift();assert.throws(()=>validateState(deleted),/claimed record changed/);
 const duplicate=structuredClone(draft);duplicate.key.claims.push({...structuredClone(duplicate.key.claims[0]),id:'different'});assert.throws(()=>validateState(duplicate),/two active claims/);
 const bad=structuredClone(draft);bad.key.claims[0].total=999;assert.throws(()=>validateState(bad),/total/);
 const cancelled=changeClaimStatus(draft,id,'cancelled');validateState(cancelled);assert.equal(unclaimedEntries(cancelled).length,3);
 const submitted=changeClaimStatus(draft,id,'submitted'),undone=changeClaimStatus(submitted,id,'void');validateState(undone);assert.equal(unclaimedEntries(undone).length,3);assert.deepEqual(claimsOf(undone)[0].history.map(e=>e.action),['created','submitted','void']);
 assert.throws(()=>selectExport(undone,{claimId:id}),/no longer available/);
 assert.equal(claimsOf(createClaim(undone,'Corrected',['sept-a'])).length,2);
});
test('pending records cannot enter a claim; duplicate receipt checks preserve leading-zero identity',()=>{
 const state=sample();state.key.confirmed=false;assert.throws(()=>createClaim(state,'Pending',['sept-a']),/pending/);
 assert.equal(duplicateReceipts(state,{...state.entries[0],id:'new'}).length,1);
 assert.equal(duplicateReceipts(state,state.entries[0]).length,0);
 assert.equal(duplicateReceipts(state,{...state.entries[0],id:'new',date:'2026-10-01'}).length,0);
});
test('claim ledger survives browser storage and backup round trips',()=>{
 const state=createClaim(sample(),'Saved',['sept-a']),values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 saveState(storage,state,null);assert.deepEqual(claimsOf(loadState(storage).state),claimsOf(state));
 assert.deepEqual(claimsOf(validateState(JSON.parse(JSON.stringify(documentOf(state))))),claimsOf(state));
});
test('concurrent claims or edits require an atomic records/history decision while rate changes merge',()=>{
 const base=sample(),local=createClaim(base,'Here',['sept-a']),remote=createClaim(base,'There',['sept-a']);
 const merged=mergeDocuments(base,local,remote);assert.equal(merged.conflicts[0].id,'claims-records');validateState(merged.document);assert.equal(claimsOf(merged.document).length,1);
 const resolved=mergeDocuments(base,local,remote,{'claims-records':'remote'});assert.equal(resolved.conflicts.length,0);assert.equal(claimsOf(resolved.document)[0].name,'There');
 const keyChange=structuredClone(base);keyChange.key.rates['addons:Elite'].first=500;
 const combined=mergeDocuments(base,local,keyChange);assert.equal(combined.conflicts.length,0);assert.equal(combined.document.key.rates['addons:Elite'].first,500);assert.equal(claimsOf(combined.document)[0].total,200);
 const edit=structuredClone(base);edit.entries[0].name='Edited';assert.equal(mergeDocuments(base,local,edit).conflicts[0].id,'claims-records');
});
test('cloud upload/download and conflict resolution retain claim reservations',async()=>{
 const base=sample();let local={...createClaim(base,'Here',['sept-a']),cloud:{owner:'owner',project:'project',base,version:1,syncedAt:''}},remote={version:2,payload:createClaim(base,'There',['sept-a'])},mode;
 const engine=new CloudSync({project:'project',active:()=>true,read:()=>local,write:next=>(local={...next,revision:crypto.randomUUID()}),status:next=>mode=next,adapter:{load:async()=>remote,write:async(_,payload,version)=>(remote={payload,version:version+1})}});
 await engine.run('owner');assert.equal(mode,'conflict');engine.resolve('remote');await engine.run('owner');assert.equal(mode,'saved');assert.equal(claimsOf(local)[0].name,'There');assert.equal(unclaimedEntries(local).length,2);
 local=initialState();await engine.run('owner');assert.equal(mode,'saved');assert.equal(claimsOf(local)[0].name,'There');
});
test('uncertain claim upload with later remote changes requires explicit history resolution',async()=>{
 const base=sample(),sent=createClaim(base,'Prepared',['sept-a']);
 let local={...sent,cloud:{owner:'owner',project:'project',base,version:1,syncedAt:'',flight:{document:documentOf(sent),remote:documentOf(base),expectedVersion:1}}};
 let remote={payload:changeClaimStatus(sent,claimsOf(sent)[0].id,'submitted'),version:3},mode;
 const engine=new CloudSync({project:'project',active:()=>true,read:()=>local,write:next=>(local={...next,revision:crypto.randomUUID()}),status:next=>mode=next,adapter:{load:async()=>remote,write:async(_,payload,version)=>(remote={payload,version:version+1})}});
 await engine.run('owner');assert.equal(mode,'conflict');assert.equal(engine.conflict.conflicts[0].id,'claims-document');engine.resolve('remote');await engine.run('owner');assert.equal(mode,'saved');assert.equal(claimsOf(local)[0].status,'submitted');assert.equal(unclaimedEntries(local).length,2);
});
