import { calculate, money } from './model.js';
import { recordDetails } from './export-table.js';

// Kept inside the existing key document so older backup/sync clients preserve it.
export const claimsOf = state => state.key.claims || [];
export const activeClaim = (state,id) => claimsOf(state).find(claim => ['draft','submitted'].includes(claim.status) && claim.rows.some(row=>row.entry.id===id));
export const unclaimedEntries = state => state.entries.filter(entry=>!activeClaim(state,entry.id));
export function createClaim(state, name, selectedIds) {
  name=name.trim();
  if (!name || name.length>80) throw new Error('Enter a claim name (up to 80 characters).');
  if (!selectedIds.length || new Set(selectedIds).size!==selectedIds.length) throw new Error('Select at least one unclaimed record.');
  const rows=selectedIds.map(id=>{
    const entry=state.entries.find(entry=>entry.id===id);
    if (!entry || activeClaim(state,id)) throw new Error('A selected record is no longer available. Reopen Create claim.');
    const result=calculate(entry,state.key);
    if (result.cents===null) throw new Error('Review pending bonuses before adding them to a claim.');
    return {entry:structuredClone(entry),cents:result.cents,details:recordDetails(entry,result)};
  }).sort((a,b)=>a.entry.date.localeCompare(b.entry.date));
  const claim={id:crypto.randomUUID(),name,status:'draft',currency:state.key.currency,rows,total:rows.reduce((sum,row)=>sum+row.cents,0),history:[{action:'created',at:new Date().toISOString()}]};
  return {...state,key:{...state.key,claims:[...claimsOf(state),claim]}};
}
export function changeClaimStatus(state,id,action) {
  const claim=claimsOf(state).find(claim=>claim.id===id);
  const allowed={draft:['submitted','cancelled'],submitted:['void']};
  if (!claim || !allowed[claim.status]?.includes(action)) throw new Error('This claim changed. Reopen it before continuing.');
  return {...state,key:{...state.key,claims:claimsOf(state).map(item=>item.id===id?{...item,status:action,history:[...item.history,{action,at:new Date().toISOString()}]}:item)}};
}
export function duplicateReceipts(state,entry) {
  return state.entries.filter(other=>other.id!==entry.id && other.date===entry.date && other.number.trim().toLocaleLowerCase()===entry.number.trim().toLocaleLowerCase());
}
export function recordBonus(state,entry) {
  const claim=activeClaim(state,entry.id);
  if (!claim) return {...calculate(entry,state.key),currency:state.key.currency};
  const cents=claim.rows.find(row=>row.entry.id===entry.id).cents;
  return {cents,subtotal:cents,parts:[],issues:[],currency:claim.currency};
}
export const claimAmount = claim => money(claim.total,claim.currency);

// Drafts reserve records, but only a submitted claim counts as claimed money.
export function bonusSummary(state) {
  const totals={unclaimed:0,claimed:0,cents:0,pending:0,otherCurrency:0};
  for(const entry of state.entries) {
    const result=recordBonus(state,entry);
    if(result.cents===null){totals.pending++;continue;}
    if(result.currency!==state.key.currency){totals.otherCurrency++;continue;}
    const bucket=activeClaim(state,entry.id)?.status==='submitted'?'claimed':'unclaimed';
    totals[bucket]+=result.cents;
  }
  totals.cents=totals.unclaimed+totals.claimed;
  return totals;
}
