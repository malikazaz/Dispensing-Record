import { monthPeriod } from './export-selection.js';
import { documentOf, equal } from './cloud-model.js';
import { claimsOf, unclaimedEntries, createClaim, changeClaimStatus, claimAmount } from './claims.js';
import { calculate, money, localDate } from './model.js';

export function installClaimsUI({read,commit,refresh,exportClaim,notify}) {
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const host=document.createElement('section');host.id='claims-view';host.className='panel';host.hidden=true;host.setAttribute('role','tabpanel');host.setAttribute('aria-labelledby','tab-claims');
  host.innerHTML='<div class="records-heading"><h2>Bonus claims</h2><button id="create-claim" class="button primary">Create claim</button></div><p class="field-hint">Keep receipts from any month together in a claim. Mark it submitted only after sending it.</p><div id="claim-summary"></div><div id="claim-list"></div>';
  $('.workspace').append(host);
  const dialogs=document.createElement('div');dialogs.innerHTML=`<dialog id="claim-create-dialog" aria-labelledby="claim-create-title"><form id="claim-create-form"><div class="dialog-heading"><h2 id="claim-create-title">Create claim</h2><button type="button" class="close-button" data-close="claim-create-dialog" aria-label="Close create claim">×</button></div><label class="field">Claim name<input id="claim-name" maxlength="80" required placeholder="October bonuses"></label><p class="field-hint">Select receipts from any month. Saved drafts reserve their records and amounts. Pending bonuses need review first.</p><div class="field"><label for="claim-month">Receipt month</label><select id="claim-month"><option value="all">All months</option></select></div><details id="claim-date-filter"><summary>Filter by dispense date</summary><p class="field-hint">Selected records stay selected when hidden by a filter.</p><div class="two-col"><label class="field">From<input id="claim-from" type="date" min="1900-01-01" max="9999-12-31"></label><label class="field">To<input id="claim-to" type="date" min="1900-01-01" max="9999-12-31"></label></div></details><div class="claim-selection-actions"><button type="button" id="claim-select-all" class="button secondary">Select all</button><button type="button" id="claim-select-none" class="link-button">Clear selection</button></div><div id="claim-choices" class="claim-choices"></div><p id="claim-selection-total" role="status"></p><p id="claim-create-error" class="inline-error" role="alert" hidden></p><div class="dialog-actions"><button type="button" class="button secondary" data-close="claim-create-dialog">Cancel</button><button id="save-claim" class="button primary">Save draft claim</button></div></form></dialog>
  <dialog id="claim-detail-dialog" aria-labelledby="claim-detail-title"><div class="dialog-heading"><h2 id="claim-detail-title"></h2><button type="button" class="close-button" data-close="claim-detail-dialog" aria-label="Close claim">×</button></div><div id="claim-detail"></div><p id="claim-detail-error" class="inline-error" role="alert" hidden></p><div id="claim-detail-actions" class="dialog-actions"></div></dialog>`;
  document.body.append(dialogs);
  for(const button of dialogs.querySelectorAll('[data-close]'))button.onclick=()=>$('#'+button.dataset.close).close();
  let selected=new Set(), baseline=null, displayed=null;
  const error=(id,text)=>{$(id).textContent=text;$(id).hidden=!text;};
  const available=()=>unclaimedEntries(read());
  const visible=()=>available().filter(entry=>(!$('#claim-from').value || entry.date>=$('#claim-from').value) && (!$('#claim-to').value || entry.date<=$('#claim-to').value));
  function selectionTotal(){
    const entries=available().filter(entry=>selected.has(entry.id));
    $('#claim-selection-total').textContent=`${entries.length} selected · ${money(entries.reduce((sum,entry)=>sum+(calculate(entry,read().key).cents||0),0),read().key.currency)}`;
    $('#save-claim').disabled=!entries.length;
  }
  function choices(){
    $('#claim-choices').innerHTML=visible().map(entry=>{const result=calculate(entry,read().key);return `<label class="claim-choice"><input type="checkbox" value="${entry.id}" ${selected.has(entry.id)?'checked':''} ${result.cents===null?'disabled':''}><span><strong>${esc(entry.name)}</strong><small>${esc(entry.date)} · #${esc(entry.number)}</small></span><b>${result.cents===null?'Pending':money(result.cents,read().key.currency)}</b></label>`;}).join('') || '<p>No unclaimed records match these dates.</p>';
    $('#claim-select-all').textContent=$('#claim-month').value && $('#claim-month').value!=='all'?'Select this month':$('#claim-from').value || $('#claim-to').value?'Select shown':'Select all';
    selectionTotal();
  }
  $('#create-claim').onclick=()=>{
    baseline=documentOf(read());selected=new Set();
    const months=[...new Set(available().map(entry=>entry.date.slice(0,7)))].sort().reverse();
    $('#claim-month').innerHTML='<option value="all">All months</option>'+months.map(month=>`<option value="${month}">${esc(new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00')))} (${available().filter(entry=>entry.date.startsWith(month)).length})</option>`).join('');
    $('#claim-month').value='all';$('#claim-date-filter').open=false;$('#claim-from').value=$('#claim-to').value='';$('#claim-name').value=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(new Date(localDate()+'T12:00:00'))+' bonuses';error('#claim-create-error','');choices();$('#claim-create-dialog').showModal();
  };
  $('#claim-month').onchange=()=>{
    const month=$('#claim-month').value;
    const range=month==='all'?{start:'',end:''}:monthPeriod('month',month+'-01');
    $('#claim-from').value=range.start;$('#claim-to').value=range.end;choices();
  };
  for(const id of ['#claim-from','#claim-to'])$(id).oninput=()=>{$('#claim-month').value='all';choices();};
  $('#claim-select-all').onclick=()=>{for(const entry of visible())if(calculate(entry,read().key).cents!==null)selected.add(entry.id);choices();};
  $('#claim-select-none').onclick=()=>{selected.clear();choices();};
  $('#claim-choices').onchange=event=>{if(event.target.checked)selected.add(event.target.value);else selected.delete(event.target.value);selectionTotal();};
  $('#claim-create-form').onsubmit=event=>{
    event.preventDefault();try{
      if(!equal(documentOf(read()),baseline))throw new Error('Records changed while you were choosing. Close this window and create the claim again.');
      if($('#claim-from').value && $('#claim-to').value && $('#claim-from').value>$('#claim-to').value)throw new Error('The end date must be on or after the start date.');
      const next=createClaim(read(),$('#claim-name').value,[...selected]);
      if(!commit(next))throw new Error('Could not save the claim. Check the account or storage message.');
      $('#claim-create-dialog').close();refresh();open(claimsOf(next).at(-1).id);notify('Draft claim saved. Download it, then mark submitted after sending.');
    }catch(e){error('#claim-create-error',e.message);}
  };
  const statusLabel={draft:'Draft',submitted:'Submitted',cancelled:'Draft cancelled',void:'Submission undone'};
  function open(id){
    const claim=claimsOf(read()).find(claim=>claim.id===id);if(!claim)return;
    displayed=structuredClone(claim);$('#claim-detail-title').textContent=claim.name;
    $('#claim-detail').innerHTML=`<p><strong>${statusLabel[claim.status]} · ${claim.rows.length} ${claim.rows.length===1?'record':'records'} · ${claimAmount(claim)}</strong></p><p class="field-hint">Saved amounts are fixed. To change these records or amounts, cancel the draft or undo its submission, then create a new claim.</p><div class="claim-choices">${claim.rows.map(row=>`<div class="claim-choice"><span><strong>${esc(row.entry.name)}</strong><small>${esc(row.entry.date)} · #${esc(row.entry.number)}</small><small>${esc(row.details)}</small></span><b>${money(row.cents,claim.currency)}</b></div>`).join('')}</div><details class="claim-history"><summary>Claim history</summary><p class="field-hint">Reference: ${claim.id}</p>${claim.history.map(event=>`<p>${({created:'Draft prepared',submitted:'Marked submitted',cancelled:'Draft cancelled',void:'Submission undone; records released'})[event.action]} · ${esc(new Date(event.at).toLocaleString('en-GB'))}</p>`).join('')}</details>`;
    $('#claim-detail-actions').innerHTML=`${['draft','submitted'].includes(claim.status)?'<button class="button secondary" data-claim-action="export">Download claim</button>':''}${claim.status==='draft'?'<button class="button secondary" data-claim-action="cancelled">Cancel draft</button><button class="button primary" data-claim-action="submitted">Mark submitted</button>':''}${claim.status==='submitted'?'<button class="button secondary" data-claim-action="void">Undo submission</button>':''}`;
    error('#claim-detail-error','');$('#claim-detail-dialog').showModal();
  }
  $('#claim-detail-actions').onclick=event=>{
    const action=event.target.closest('[data-claim-action]')?.dataset.claimAction;if(!action || !displayed)return;
    try {
      const current=claimsOf(read()).find(claim=>claim.id===displayed.id);
      if(!equal(current,displayed))throw new Error('This claim changed online. Close and reopen it first.');
      if(action==='export'){$('#claim-detail-dialog').close();exportClaim(current.id);return;}
      const message=action==='submitted'?`Confirm you have sent “${current.name}”: ${current.rows.length} ${current.rows.length===1?'record':'records'}, ${claimAmount(current)}? These records will be marked submitted.`:action==='void'?`Undo submission of “${current.name}”? Its records will become available to claim again. Only continue if this corrects a mistake; do not resubmit a bonus already paid.`:`Cancel draft “${current.name}” and release its records? Its history will remain.`;
      if(!confirm(message))return;
      if(!commit(changeClaimStatus(read(),current.id,action)))throw new Error('Could not save this change. Check the account or storage message.');
      refresh();open(current.id);notify('Claim status saved on this device. Check Account for online sync status.');
    }catch(e){error('#claim-detail-error',e.message);}
  };
  $('#claim-list').onclick=event=>{const button=event.target.closest('[data-claim-id]');if(button)open(button.dataset.claimId);};
  function render(){
    const state=read(),entries=unclaimedEntries(state),pending=entries.filter(entry=>calculate(entry,state.key).cents===null).length;
    $('#claim-summary').textContent=`${entries.length} unclaimed ${entries.length===1?'record':'records'}${pending?` · ${pending} pending review`:''}`;
    $('#claim-list').innerHTML=claimsOf(state).slice().reverse().map(claim=>`<button class="claim-card" data-claim-id="${claim.id}"><span><strong>${esc(claim.name)}</strong><small>${statusLabel[claim.status]} · ${claim.rows.length} ${claim.rows.length===1?'record':'records'}</small></span><b>${claimAmount(claim)}</b></button>`).join('') || '<p class="field-hint">No claims yet. Your existing records are unclaimed.</p>';
  }
  return {render,close:()=>{for(const dialog of dialogs.querySelectorAll('dialog'))dialog.close();}};
}
