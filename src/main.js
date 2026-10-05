import './style.css';
import { GROUPS, MODES, blankEntry, calculate, localDate, money, parseRate, ruleId, summarise, validateEntry, validateState, initialState } from './model.js';
import { loadState, saveState, STORAGE_KEY } from './storage.js';
import { monthPeriod, selectExport, exportFilename, periodLabel } from './export-selection.js';

const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({ glasses:'<circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><path d="M10 13h4M2 13l2-8h3m15 8-2-8h-3"/>', download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>', plus:'<path d="M12 5v14M5 12h14"/>', book:'<path d="M4 4h13a3 3 0 0 1 3 3v14H6a2 2 0 0 1-2-2zm0 13h16M8 8h8m-8 4h5"/>', check:'<path d="m5 12 4 4L19 6"/>', edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>', trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>' })[name] || ''}</svg>`;
let state = initialState(), raw = null, storageError = '', editing = null;
try { ({state,raw} = loadState(localStorage)); }
catch { storageError = 'Saved records could not be read. Existing storage has been left untouched. Download the stored data below for recovery, or restore a valid backup.'; }
const fmt = (cents) => money(cents,state.key.currency);

$('#app').innerHTML = `
  <header class="topbar"><div class="brand"><span class="brand-mark">${icon('glasses')}</span><span>Dispensing<span class="brand-light"> Record</span></span></div><span class="local-label"><span class="dot"></span>Stored on this device</span></header>
  <main>
    <div class="page-heading"><div><p class="eyebrow">YOUR DAILY DISPENSING LOG</p><h1>A little less paperwork.</h1><p class="subtitle">Record the dispense. We’ll take care of the bonus.</p></div><button id="export" class="button primary">${icon('download')}Export Excel</button></div>
    <div id="notice" role="status" aria-live="polite" hidden></div>
    <div id="storage-error" class="warning" role="alert" hidden></div>
    <section class="stats" aria-label="Record summary">
      <div class="stat"><span class="stat-label">Total bonus <span id="total-status"></span></span><strong id="total">€0.00</strong><span id="total-caption" class="stat-note">Across all records</span></div>
      <div class="stat"><span class="stat-label">Dispensing records</span><strong id="count">0</strong><span class="stat-note">Everything in one place</span></div>
      <div class="stat"><span class="stat-label">Recorded today</span><strong id="today-count">0</strong><span id="today-label" class="stat-note"></span></div>
    </section>
    <div class="workspace">
      <section class="panel form-panel" aria-labelledby="form-title">
        <div class="panel-heading"><div class="heading-icon">${icon('plus')}</div><div><h2 id="form-title">New dispense</h2><p>One record for each dispense.</p></div></div>
        <form id="entry-form">
          <div class="two-col"><label class="field">Date<input type="date" name="date" required min="1900-01-01" max="9999-12-31"></label><label class="field">Customer number<input name="number" type="text" maxlength="80" placeholder="e.g. 001234" required autocomplete="off"></label></div>
          <label class="field">Customer name<input name="name" maxlength="160" placeholder="Enter customer name" required autocomplete="off"></label>
          <fieldset><legend>Dispense type <span>Select all that apply</span></legend><div class="chips types">${choices('types')}</div></fieldset>
          <fieldset><legend>Lens set</legend><div class="segmented"><label><input type="radio" name="set" value="first" checked><span>1st set of lenses</span></label><label><input type="radio" name="set" value="second"><span>2nd set of lenses</span></label></div></fieldset>
          <fieldset><legend>Add-ons <span>Optional</span></legend><div class="chips">${choices('addons')}</div><p class="field-hint">Select each purchased add-on once. Combined options, such as Polaroid 1.6, have their own rate.</p></fieldset>
          <details class="offers"><summary>Special offers <span>Optional</span></summary><div class="offer-list">${choices('offers',true)}</div></details>
          <div id="bonus-preview" class="bonus-preview" aria-live="polite"></div>
          <div id="form-error" class="inline-error" role="alert" hidden></div>
          <div class="form-actions"><button id="save-entry" type="submit" class="button primary">${icon('plus')}Save dispense</button><button id="cancel-edit" class="button secondary" type="button" hidden>Cancel edit</button></div>
        </form>
      </section>
      <section class="panel records-panel" aria-labelledby="records-title"><div class="records-heading"><div><h2 id="records-title">Your records <span id="record-badge" class="badge">0</span></h2><p>Saved here, ready whenever you need them.</p></div><button id="open-key" class="button text-button">${icon('book')}Bonus key</button></div>
        <div class="records-toolbar"><label class="search-field"><span class="sr-only">Search records</span><input id="search" type="search" placeholder="Search by name or customer number"></label><span id="shown-count"></span></div>
        <div id="records"></div>
        <div class="records-footer"><span id="footer-summary"></span><span>Export all records or choose a bonus period.</span></div>
      </section>
    </div>
    <footer class="page-footer"><p>${icon('check')}Records stay in this browser. Back up regularly; clearing browser data removes them.</p><div><button id="backup" class="link-button">Download backup</button><button id="restore" class="link-button">Restore backup</button><input id="restore-file" type="file" accept="application/json,.json" hidden><button id="raw-backup" class="link-button" hidden>Download stored data</button></div></footer>
  </main>
  <dialog id="export-dialog" aria-labelledby="export-title"><form id="export-form">
    <div class="dialog-heading"><div><p class="eyebrow">BONUS REPORT</p><h2 id="export-title">Export your records</h2></div><button type="button" id="close-export" class="close-button" aria-label="Close export">×</button></div>
    <p class="dialog-intro">Choose the period you’re claiming for. Your Excel file will contain just those records, with its own heading and bonus total.</p>
    <label class="field">Export period<select id="export-preset"><option value="month">This month</option><option value="previous-month">Last month</option><option value="custom">Custom dates</option><option value="all">All records</option></select></label>
    <div id="export-dates" class="two-col"><label class="field">Start date<input id="export-start" type="date" required min="1900-01-01" max="9999-12-31"></label><label class="field">End date<input id="export-end" type="date" required min="1900-01-01" max="9999-12-31"></label></div>
    <label class="field">Section name <span class="field-hint">Optional, e.g. October bonuses</span><input id="export-name" maxlength="80" placeholder="Bonus period"></label>
    <div id="export-summary" class="export-summary" role="status" aria-live="polite"></div>
    <div id="export-error" class="inline-error" role="alert" hidden></div>
    <p class="field-hint export-hint">Both dates are included. The record-list search does not affect this export. Your saved records stay on this device.</p>
    <div class="dialog-actions"><button type="button" id="cancel-export" class="button secondary">Cancel</button><button id="download-export" class="button primary" type="submit">${icon('download')}Download Excel</button></div>
  </form></dialog>
  <dialog id="key-dialog" aria-labelledby="key-title"><form id="key-form"><div class="dialog-heading"><div><p class="eyebrow">REFERENCE & SETTINGS</p><h2 id="key-title">Your bonus key</h2></div><button type="button" id="close-key" class="close-button" aria-label="Close bonus key">×</button></div><p class="dialog-intro">Amounts are per selected item. Leave an unknown rate blank; use 0 for a column that earns no bonus. Saving changes recalculates every record.</p><div id="key-content"></div><div id="key-error" class="inline-error" role="alert" hidden></div><div class="dialog-actions"><button type="button" id="cancel-key" class="button secondary">Cancel</button><button class="button primary" type="submit">Save bonus key</button></div></form></dialog>`;

function choices(group, long=false) {
  return GROUPS[group].map(label => `<label class="${long?'offer-choice':'chip'}"><input type="checkbox" name="${group}" value="${escape(label)}"><span>${escape(label)}</span></label>`).join('');
}
function notify(message) { $('#notice').textContent = message; $('#notice').hidden = false; }
function showError(target,message) { target.textContent = message; target.hidden = !message; }
function displayStorageError() { showError($('#storage-error'),storageError); $('#raw-backup').hidden = !storageError; }
function commit(next) {
  try {
    if (storageError) throw new Error(storageError);
    ({state,raw} = saveState(localStorage,next,raw));
    return true;
  } catch(error) {
    showError($('#storage-error'),`Changes were not saved. ${error.message} Your current form is still available.`);
    return false;
  }
}
function readEntry() {
  const form = new FormData($('#entry-form'));
  return { id: editing || '', date: form.get('date'), number: form.get('number').trim(), name: form.get('name').trim(), set: form.get('set'), ...Object.fromEntries(Object.keys(GROUPS).map(group => [group,form.getAll(group)])) };
}
function fillEntry(entry=blankEntry()) {
  const form = $('#entry-form');
  for (const name of ['date','number','name']) form.elements[name].value = entry[name];
  for (const input of form.querySelectorAll('input[type="checkbox"]')) input.checked = entry[input.name].includes(input.value);
  for (const input of form.querySelectorAll('input[name="set"]')) input.checked = input.value === entry.set;
  $('.offers').open = entry.offers.length > 0;
  $('#form-title').textContent = editing ? 'Edit dispense' : 'New dispense';
  $('#save-entry').innerHTML = `${icon(editing ? 'check':'plus')}${editing ? 'Save changes':'Save dispense'}`;
  $('#cancel-edit').hidden = !editing;
  showError($('#form-error'),'');
  updatePreview();
}
function updatePreview() {
  const result = calculate(readEntry(),state.key);
  const selected = readEntry().types.length > 0;
  $('#bonus-preview').innerHTML = `<div class="bonus-line"><span>${result.cents === null && selected ? 'Bonus needs review':'Bonus for this dispense'}</span><strong>${!selected ? '—' : result.cents === null ? 'Pending' : fmt(result.cents)}</strong></div>${selected ? `<div class="breakdown">${result.parts.filter(p=>p.cents).map(p=>`<span>${escape(p.label)} <b>${fmt(p.cents)}</b></span>`).join('') || 'No additional bonus selected.'}</div>${result.issues.length ? `<ul class="issue-list">${result.issues.map(s=>`<li>${escape(s)}</li>`).join('')}</ul>` : ''}` : '<p>Select a dispense type to get started.</p>'}`;
}
function dateText(date) { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00`)); }
function renderRecords() {
  const totals = summarise(state.entries,state.key);
  $('#total').textContent = fmt(totals.cents);
  $('#total-status').textContent = totals.pending ? '· confirmed' : '';
  $('#total-caption').textContent = totals.pending ? `${totals.pending} pending ${totals.pending===1?'record excluded':'records excluded'}` : 'Across all records';
  $('#count').textContent = state.entries.length;
  $('#record-badge').textContent = state.entries.length;
  $('#today-count').textContent = state.entries.filter(e=>e.date===localDate()).length;
  $('#today-label').textContent = dateText(localDate());
  $('#export').disabled = !state.entries.length;
  const query = $('#search').value.trim().toLocaleLowerCase();
  const entries = state.entries.filter(e=>`${e.name} ${e.number}`.toLocaleLowerCase().includes(query)).slice().sort((a,b)=>b.date.localeCompare(a.date));
  $('#shown-count').textContent = `${entries.length} ${entries.length===1?'record':'records'}`;
  $('#footer-summary').textContent = `Total ${totals.pending?'confirmed bonus':'bonus'}: ${fmt(totals.cents)}`;
  if (!entries.length) {
    $('#records').innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('book')}</span><h3>${query?'No matching records':'A fresh page for your day'}</h3><p>${query?'Try a different name or customer number.':'Add your first dispense. Your records and running bonus will appear here.'}</p>${query?'':'<span class="empty-caption">Every dispense, neatly recorded.</span>'}</div>`;
    return;
  }
  $('#records').innerHTML = `<div class="table-scroll"><table class="record-table"><thead><tr><th>Date / customer</th><th>Dispense details</th><th class="bonus-heading">Bonus</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${entries.map(entry=>{
    const result=calculate(entry,state.key);
    return `<tr><td><span class="record-date">${dateText(entry.date)}</span><strong class="customer-name">${escape(entry.name)}</strong><span class="customer-number">#${escape(entry.number)}</span></td><td><div class="record-tags">${entry.types.map(t=>`<span>${escape(t)}</span>`).join('')}<span class="set-tag">${entry.set==='first'?'1st':'2nd'} set</span></div><p class="record-addons">${escape(entry.addons.join(' + ') || 'No add-ons')}</p>${entry.offers.length?`<p class="record-offers">${escape(entry.offers.join(' · '))}</p>`:''}${result.issues.length?`<details class="row-review"><summary>Review bonus</summary><ul>${result.issues.map(i=>`<li>${escape(i)}</li>`).join('')}</ul></details>`:''}</td><td class="row-bonus ${result.cents===null?'pending':''}">${result.cents===null?'Pending':fmt(result.cents)}</td><td class="row-actions"><button class="icon-button" data-action="edit" data-id="${entry.id}" aria-label="Edit ${escape(entry.name)}">${icon('edit')}</button><button class="icon-button danger" data-action="remove" data-id="${entry.id}" aria-label="Remove ${escape(entry.name)}">${icon('trash')}</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

$('#entry-form').addEventListener('input', updatePreview);
$('#entry-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const entry = readEntry(); validateEntry(entry);
    entry.id ||= crypto.randomUUID();
    const entries = editing ? state.entries.map(e=>e.id===editing?entry:e) : [...state.entries,entry];
    if (!commit({...state,entries})) return;
    notify(editing ? 'Record updated.' : 'Dispense saved on this device.');
    editing=null; fillEntry(); renderRecords();
    $('#entry-form').elements.number.focus();
  } catch(error) { showError($('#form-error'),error.message); }
});
$('#cancel-edit').addEventListener('click',()=>{editing=null;fillEntry();});
$('#search').addEventListener('input',renderRecords);
$('#records').addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]'); if(!button)return;
  const entry=state.entries.find(e=>e.id===button.dataset.id); if(!entry)return;
  if(button.dataset.action==='edit') {
    if (editing && editing!==entry.id && !confirm('Discard the current edit and open this record?')) return;
    editing=entry.id;fillEntry(entry);$('.form-panel').scrollIntoView({behavior:'smooth',block:'start'});$('#entry-form').elements.name.focus({preventScroll:true});
  } else if(confirm(`Remove the record for ${entry.name} (${entry.number})?`)) {
    if(!commit({...state,entries:state.entries.filter(e=>e.id!==entry.id)}))return;
    if(editing===entry.id){editing=null;fillEntry();}
    renderRecords();notify('Record removed.');
  }
});

function openKey() {
  $('#key-content').innerHTML = `<label class="field currency-field">Currency<select name="currency"><option value="EUR" ${state.key.currency==='EUR'?'selected':''}>Euro (€)</option><option value="GBP" ${state.key.currency==='GBP'?'selected':''}>Pound (£)</option></select></label><p class="field-hint">Changing currency relabels amounts; it does not convert them.</p>${Object.entries(GROUPS).map(([group,labels])=>`<section class="key-section"><h3>${({types:'Paper-table columns',addons:'Add-ons',offers:'Special offers'})[group]}</h3>${group==='types'?'<p class="field-hint">Columns without a listed bonus use 0. Select all applicable paper columns.</p>':''}<div class="rate-head"><span>Item</span><span>1st set</span><span>2nd set</span></div>${labels.map(label=>{
    const id=ruleId(group,label),rate=state.key.rates[id];
    return `<div class="rate-row"><span>${escape(label)}</span>${['first','second'].map(set=>`<input aria-label="${escape(label)} ${set==='first'?'1st':'2nd'} set rate" name="${escape(`${id}:${set}`)}" type="number" min="0" max="10000" step="0.01" inputmode="decimal" placeholder="Unknown" value="${rate[set]===null?'':(rate[set]/100).toFixed(2)}">`).join('')}</div>${group==='offers'?`<label class="offer-mode">How this offer applies<select name="${escape(id)}:mode" aria-label="${escape(label)} calculation"><option value="">Needs confirmation</option>${Object.entries(MODES).map(([mode,text])=>`<option value="${mode}" ${rate.mode===mode?'selected':''}>${text}</option>`).join('')}</select></label>`:''}`;
  }).join('')}</section>`).join('')}<div class="key-notes"><strong>How offers work</strong><p>Second-pair offers require the 2nd set; the SV offer also requires SV. The third-pair offer requires 241. Golden Ticket adds an extra amount for each add-on. Under the second-pair SV offer, any add-ons automatically switch to one flat payment instead of the basic bonus and individual add-on rates. The supplied basic SV rate is €3; this can be corrected here if needed. The flat rate defaults to €5. Distinct replacement offers cannot be combined.</p><p>Combined add-ons are separate choices: choose Polaroid 1.6 instead of also selecting Polaroid and 1.6 for the same lens.</p></div><label class="field">Source / notes<textarea name="source" rows="3" maxlength="4000">${escape(state.key.source)}</textarea></label><label class="confirm-key"><input name="confirmed" type="checkbox" ${state.key.confirmed?'checked':''}><span>I have checked these rates and how the selected bonuses combine.</span></label>`;
  showError($('#key-error'),'');$('#key-dialog').showModal();
}
$('#open-key').addEventListener('click',openKey);
$('#close-key').addEventListener('click',()=>$('#key-dialog').close());
$('#cancel-key').addEventListener('click',()=>$('#key-dialog').close());
$('#key-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const data=new FormData(event.target),key=structuredClone(state.key);
    key.currency=data.get('currency');key.confirmed=data.has('confirmed');key.source=data.get('source');
    for(const [group,labels]of Object.entries(GROUPS))for(const label of labels){
      const id=ruleId(group,label);
      key.rates[id]={first:parseRate(data.get(`${id}:first`)),second:parseRate(data.get(`${id}:second`)),mode:group==='offers'?(data.get(`${id}:mode`)||null):'add'};
    }
    if(state.entries.length && !confirm('Save this key and recalculate every existing record?'))return;
    if(!commit({...state,key}))return;
    $('#key-dialog').close();updatePreview();renderRecords();notify('Bonus key saved. All records have been recalculated.');
  }catch(error){showError($('#key-error'),error.message);}
});

function download(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
let exportBusy = false;
function exportOptions() {
  return { mode: $('#export-preset').value === 'all' ? 'all' : 'custom', start: $('#export-start').value, end: $('#export-end').value, name: $('#export-name').value };
}
function updateExportPreview() {
  showError($('#export-error'),'');
  try {
    const selection = selectExport(state,exportOptions());
    $('#export-summary').innerHTML = `<p>${escape(periodLabel(selection))}</p><div><span>${selection.entries.length} ${selection.entries.length === 1 ? 'record' : 'records'}</span><strong>${fmt(selection.total.cents)}</strong></div><p>${selection.total.pending ? `${selection.total.pending} pending ${selection.total.pending === 1 ? 'record is' : 'records are'} excluded from this confirmed total.` : 'Total bonus for this export.'}</p>${selection.entries.length ? '' : '<p class="export-empty">No records in this period. Choose different dates or All records.</p>'}`;
    $('#download-export').disabled = exportBusy || !selection.entries.length;
  } catch(error) {
    $('#export-summary').textContent = 'Choose a valid period to preview its records and bonus total.';
    showError($('#export-error'),error.message);
    $('#download-export').disabled = true;
  }
}
function applyExportPreset() {
  const preset = $('#export-preset').value;
  if (['month','previous-month'].includes(preset)) {
    const range = monthPeriod(preset);
    $('#export-start').value = range.start; $('#export-end').value = range.end;
  }
  $('#export-dates').hidden = preset === 'all';
  $('#export-start').disabled = $('#export-end').disabled = preset === 'all';
  updateExportPreview();
}
$('#export').addEventListener('click',()=>{
  // Keep the chosen period during this visit, but recompute its preview from current records.
  if (!$('#export-start').value) applyExportPreset(); else updateExportPreview();
  $('#export-dialog').showModal();
});
$('#export-preset').addEventListener('change',applyExportPreset);
for (const id of ['#export-start','#export-end']) $(id).addEventListener('input',()=>{
  $('#export-preset').value = 'custom'; updateExportPreview();
});
$('#export-name').addEventListener('input',updateExportPreview);
$('#close-export').addEventListener('click',()=>$('#export-dialog').close());
$('#cancel-export').addEventListener('click',()=>$('#export-dialog').close());
$('#export-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if (exportBusy) return;
  const button=$('#download-export');
  try {
    const snapshot=structuredClone(state),options=exportOptions(),selection=selectExport(snapshot,options);
    if (!selection.entries.length) throw new Error('No records in this period. Choose different dates.');
    exportBusy=true;button.disabled=true;button.textContent='Preparing Excel…';
    // Keep the visible selection consistent with the snapshot while the file is generated.
    for (const input of $('#export-form').querySelectorAll('input,select')) input.disabled=true;
    const {exportWorkbook}=await import('./workbook.js');
    const buffer=await exportWorkbook(snapshot,options);
    download(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),exportFilename(selection));
    $('#export-dialog').close();
    notify(`Excel file prepared: ${periodLabel(selection)} · ${selection.entries.length} records.`);
  }catch(error){showError($('#export-error'),`Excel export failed: ${error.message}. Your records are still saved.`);}
  finally{
    exportBusy=false;button.disabled=false;button.innerHTML=`${icon('download')}Download Excel`;
    for (const input of $('#export-form').querySelectorAll('input,select')) input.disabled=false;
    $('#export-start').disabled=$('#export-end').disabled=$('#export-preset').value==='all';
  }
});
$('#backup').addEventListener('click',()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`dispensing-backup-${localDate()}.json`));
$('#raw-backup').addEventListener('click',()=>{
  try{download(new Blob([localStorage.getItem(STORAGE_KEY)||''],{type:'text/plain'}),'dispensing-stored-data.txt');}catch{notify('Browser storage is unavailable.');}
});
$('#restore').addEventListener('click',()=>$('#restore-file').click());
$('#restore-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>10000000)throw new Error('Backup is too large (maximum 10 MB).');
    const restored=validateState(JSON.parse(await file.text()));
    if(!confirm(`Replace the records and bonus key on this device with ${restored.entries.length} records from this backup? Download a backup first if needed.`))return;
    // Intentional replacement is also the recovery path for unreadable saved data.
    const expected=localStorage.getItem(STORAGE_KEY);
    ({state,raw}=saveState(localStorage,restored,expected));storageError='';displayStorageError();editing=null;fillEntry();renderRecords();notify('Backup restored and saved on this device.');
  }catch(error){notify(`Could not restore backup: ${error.message}`);}
  finally{event.target.value='';}
});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)showError($('#storage-error'),'Records changed in another tab. Reload to see the latest records before saving.');});
displayStorageError();fillEntry();renderRecords();
