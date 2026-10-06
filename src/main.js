import './style.css';
import { loadExporter, ExportLoadError } from './export-loader.js';
import { GROUPS, ACTIVE_BONUS_GROUPS, THIRD_PAIR_OFFERS, thirdPairRate, hasLegacyThirdPair, MODES, blankEntry, lensSetsOf, calculate, localDate, money, parseRate, ruleId, summarise, validateEntry, validateState, initialState, validDate } from './model.js';
import { loadState, saveState, STORAGE_KEY } from './storage.js';
import { monthPeriod, selectExport, exportFilename, periodLabel } from './export-selection.js';
import { documentOf, equal } from './cloud-model.js';
import { installCloudUI } from './cloud-ui.js';
import { ENTRY_DATE_KEY, readEntryDate, stepDate } from './entry-date.js';

const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({ glasses:'<circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><path d="M10 13h4M2 13l2-8h3m15 8-2-8h-3"/>', download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>', plus:'<path d="M12 5v14M5 12h14"/>', book:'<path d="M4 4h13a3 3 0 0 1 3 3v14H6a2 2 0 0 1-2-2zm0 13h16M8 8h8m-8 4h5"/>', check:'<path d="m5 12 4 4L19 6"/>', edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>', trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>' })[name] || ''}</svg>`;
let state = initialState(), raw = null, storageError = '', editing = null, editingOriginal = null, keyOriginal = null, cloud = null;
try { ({state,raw} = loadState(localStorage)); }
catch { storageError = 'Saved records could not be read. Existing storage has been left untouched. Download the stored data below for recovery, or restore a valid backup.'; }
const fmt = (cents) => money(cents,state.key.currency);
let legacyThirdPair=false;
let lensDraft, activeLensSet = 'first', legacyLensSet = null;
let entryDate;
try { entryDate = readEntryDate(sessionStorage); } catch { entryDate = localDate(); }

$('#app').innerHTML = `
  <header class="topbar"><div class="brand"><span class="brand-mark">${icon('glasses')}</span><span>Dispensing<span class="brand-light"> Record</span></span></div><div class="account-wrapper"><button id="account-toggle" class="account-toggle" aria-expanded="false" aria-controls="account-menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span>Account</span><span id="account-dot" class="dot" aria-hidden="true"></span></button><div id="account-menu" class="account-menu" aria-label="Account settings" hidden></div></div></header>
  <main>
    <h1 class="sr-only">Dispensing Record</h1>
    <div id="notice" role="status" aria-live="polite" hidden></div>
    <div id="storage-error" class="warning" role="alert" hidden></div>
    <p id="locked-message" class="locked-message" hidden>Open Account to sign in to your records.</p>
    <section class="stats" aria-label="Record summary">
      <div class="stat"><span class="stat-label">Total bonus <span id="total-status"></span></span><strong id="total">€0.00</strong><span id="total-caption" class="stat-note">Across all records</span></div>
      <div class="stat"><span class="stat-label">Dispensing records</span><strong id="count">0</strong></div>
      <div class="stat"><span class="stat-label">Recorded today</span><strong id="today-count">0</strong></div>
    </section>
    <div class="view-toolbar"><div class="view-tabs" role="tablist" aria-label="Workspace"><button id="tab-entry" role="tab" aria-selected="true" aria-controls="entry-view">New dispense</button><button id="tab-records" role="tab" aria-selected="false" aria-controls="records-view" tabindex="-1">Records</button></div><button id="export" class="button secondary" aria-label="Export records">${icon('download')}<span>Export</span></button></div>
    <div class="workspace">
      <section id="entry-view" class="panel form-panel" role="tabpanel" aria-labelledby="tab-entry">
        <h2 id="form-title" class="sr-only">New dispense</h2>
        <form id="entry-form">
          <div class="two-col"><div class="field"><label for="dispense-date">Date</label><div class="date-stepper"><button id="previous-date" type="button" class="date-arrow" aria-label="Previous day">‹</button><input id="dispense-date" type="date" name="date" required min="1900-01-01" max="9999-12-31"><button id="next-date" type="button" class="date-arrow" aria-label="Next day">›</button></div></div><label class="field">Customer number<input name="number" type="text" inputmode="numeric" maxlength="80" placeholder="e.g. 001234" required autocomplete="off"></label></div>
          <div class="field"><label for="customer-name">Customer name</label><input id="customer-name" name="name" autocapitalize="words" maxlength="160" placeholder="Enter customer name" required autocomplete="off" aria-describedby="customer-name-warning"><span id="customer-name-warning" class="name-warning" role="status" hidden>Check the customer name. It contains a number.</span></div>
          <fieldset><legend>Dispense type <span>Select all that apply</span></legend><div class="chips types">${choices('types')}</div></fieldset>
          <fieldset><legend>Lens sets</legend><div class="segmented"><label><input type="radio" name="set" value="first" checked><span>1st set of lenses</span></label><label><input type="radio" name="set" value="second"><span>2nd set of lenses</span></label></div><p class="field-hint">Select add-ons and offers for each set. Both sets save in one record.</p></fieldset>
          <fieldset><legend>Add-ons <span>Optional</span></legend><div class="chips">${choices('addons')}</div></fieldset>
          <details class="offers"><summary>Special offers <span>Optional</span></summary><div class="offer-list">${choices('offers',true)}<label class="offer-choice"><input id="third-pair-enabled" type="checkbox" aria-controls="third-pair-addons" aria-expanded="false"><span>Golden Ticket / Third pair half price</span></label></div><fieldset id="third-pair-addons" class="third-pair-addons" hidden><legend>Third-pair add-ons</legend><p id="third-pair-hint" class="field-hint"></p><div class="chips">${choices('thirdAddons')}</div></fieldset><p id="third-pair-review" class="inline-error" hidden>Review this older offer: select the third-pair add-ons below, or untick the offer if it does not apply.</p></details>
          <div id="bonus-preview" class="bonus-preview" aria-live="polite"></div>
          <div id="form-error" class="inline-error" role="alert" hidden></div>
          <div class="form-actions"><button id="save-entry" type="submit" class="button primary">${icon('plus')}Save dispense</button><button id="clear-entry" class="button secondary" type="button">Clear form</button><button id="cancel-edit" class="button secondary" type="button" hidden>Cancel edit</button></div>
        </form>
      </section>
      <section id="records-view" class="panel records-panel" role="tabpanel" aria-labelledby="tab-records" hidden><div class="records-heading"><h2 id="records-title">Records <span id="record-badge" class="badge">0</span></h2><button id="open-key" class="button text-button">${icon('book')}Bonus key</button></div>
        <div class="records-toolbar"><label class="search-field"><span class="sr-only">Search records</span><input id="search" type="search" placeholder="Search by name or customer number"></label><span id="shown-count"></span></div>
        <div id="records"></div>
        <div class="records-footer"><span id="footer-summary"></span></div>
      </section>
    </div>
    <footer class="page-footer"><p>${icon('check')}Records stay in this browser. Back up regularly; clearing browser data removes them.</p><div><button id="backup" class="link-button">Download backup</button><button id="restore" class="link-button">Restore backup</button><input id="restore-file" type="file" accept="application/json,.json" hidden><button id="raw-backup" class="link-button" hidden>Download stored data</button></div></footer>
  </main>
  <dialog id="export-dialog" aria-labelledby="export-title"><form id="export-form">
    <div class="dialog-heading"><div><p class="eyebrow">BONUS REPORT</p><h2 id="export-title">Export your records</h2></div><button type="button" id="close-export" class="close-button" aria-label="Close export">×</button></div>
    <p class="dialog-intro">Choose a format and the period you’re claiming for. Your file will contain just those records, with its own heading and bonus total.</p>
    <label class="field">File format<select id="export-format"><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF (.pdf)</option></select></label>
    <label class="field">Export period<select id="export-preset"><option value="month">This month</option><option value="previous-month">Last month</option><option value="custom">Custom dates</option><option value="all">All records</option></select></label>
    <div id="export-dates" class="two-col"><label class="field">Start date<input id="export-start" type="date" required min="1900-01-01" max="9999-12-31"></label><label class="field">End date<input id="export-end" type="date" required min="1900-01-01" max="9999-12-31"></label></div>
    <label class="field">Section name <span class="field-hint">Optional, e.g. October bonuses</span><input id="export-name" maxlength="80" placeholder="Bonus period"></label>
    <div id="export-summary" class="export-summary" role="status" aria-live="polite"></div>
    <div id="export-error" class="inline-error" role="alert" hidden></div>
    <button type="button" id="refresh-export" class="button secondary" hidden>Refresh app</button>
    <p class="field-hint export-hint">Both dates are included. The record-list search does not affect this export. Your saved records stay on this device.</p>
    <div class="dialog-actions"><button type="button" id="cancel-export" class="button secondary">Cancel</button><button id="download-export" class="button primary" type="submit">${icon('download')}Download Excel</button></div>
  </form></dialog>
  <dialog id="key-dialog" aria-labelledby="key-title"><form id="key-form"><div class="dialog-heading"><div><p class="eyebrow">REFERENCE & SETTINGS</p><h2 id="key-title">Your bonus key</h2></div><button type="button" id="close-key" class="close-button" aria-label="Close bonus key">×</button></div><p class="dialog-intro">Amounts are per selected item. Leave an unknown rate blank; use 0 for a column that earns no bonus. Saving changes recalculates every record.</p><div id="key-content"></div><div id="key-error" class="inline-error" role="alert" hidden></div><div class="dialog-actions"><button type="button" id="cancel-key" class="button secondary">Cancel</button><button class="button primary" type="submit">Save bonus key</button></div></form></dialog>`;

function choices(group, long=false) {
  return (group==='offers'?ACTIVE_BONUS_GROUPS.offers:group==='thirdAddons'?GROUPS.addons:GROUPS[group]).map(label => `<label class="${long?'offer-choice':'chip'}"><input type="checkbox" name="${group}" value="${escape(label)}"><span>${escape(label)}</span></label>`).join('');
}
let noticeTimer;
function notify(message) { $('#notice').textContent = message; $('#notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 5000); }
function showError(target,message) { target.textContent = message; target.hidden = !message; }
function displayStorageError() { showError($('#storage-error'),storageError); $('#raw-backup').hidden = !storageError; }
function commit(next) {
  try {
    if (storageError) throw new Error(storageError);
    if (cloud && !cloud.canEdit()) throw new Error('Sign in to the account linked to these records first.');
    ({state,raw} = saveState(localStorage,next,raw));
    cloud?.changed();
    return true;
  } catch(error) {
    showError($('#storage-error'),`Changes were not saved. ${error.message} Your current form is still available.`);
    return false;
  }
}
function captureLensSet() {
  const form = new FormData($('#entry-form'));
  lensDraft[activeLensSet] = { addons: form.getAll('addons'), offers: form.getAll('offers') };
}
function showLensSet() {
  for (const group of ['addons','offers']) for (const input of $('#entry-form').querySelectorAll(`input[name="${group}"]`)) input.checked = lensDraft[activeLensSet][group].includes(input.value);
  $('.offers').open = lensDraft[activeLensSet].offers.length > 0 || $('#third-pair-enabled').checked;
}
function readEntry() {
  captureLensSet();
  const form = new FormData($('#entry-form'));
  const base = { id: editing || '', date: form.get('date'), number: form.get('number').trim(), name: form.get('name').trim(), types: form.getAll('types'), thirdPair:{enabled:$('#third-pair-enabled').checked,addons:$('#third-pair-enabled').checked?form.getAll('thirdAddons'):[]} };
  // Old single-set records retain their original calculation until another set is added.
  const otherSet = legacyLensSet === 'first' ? 'second' : 'first';
  if (legacyLensSet && !lensDraft[otherSet].addons.length && !lensDraft[otherSet].offers.length) return {...base, set: legacyLensSet, ...structuredClone(lensDraft[legacyLensSet])};
  return { ...base, set: activeLensSet, ...structuredClone(lensDraft[activeLensSet]), lensSets: structuredClone(lensDraft) };
}
function fillEntry(entry={...blankEntry(),date:entryDate}) {
  const form = $('#entry-form');
  lensDraft = lensSetsOf(entry);
  legacyThirdPair=hasLegacyThirdPair(entry);
  for (const set of Object.values(lensDraft)) set.offers=set.offers.filter(offer=>!THIRD_PAIR_OFFERS.includes(offer));
  $('#third-pair-enabled').checked=entry.thirdPair?.enabled || legacyThirdPair;
  for (const input of form.querySelectorAll('input[name="thirdAddons"]')) input.checked=entry.thirdPair?.addons.includes(input.value) || false;
  updateThirdPair();
  activeLensSet = entry.set;
  legacyLensSet = entry.id && !entry.lensSets ? entry.set : null;
  for (const name of ['date','number','name']) form.elements[name].value = entry[name];
  for (const input of form.querySelectorAll('input[name="types"]')) input.checked = entry.types.includes(input.value);
  for (const input of form.querySelectorAll('input[name="set"]')) input.checked = input.value === activeLensSet;
  showLensSet();
  $('#form-title').textContent = editing ? 'Edit dispense' : 'New dispense';
  $('#save-entry').innerHTML = `${icon(editing ? 'check':'plus')}${editing ? 'Save changes':'Save dispense'}`;
  $('#cancel-edit').hidden = !editing;
  showError($('#form-error'),'');
  updateNameWarning();
  updatePreview();
  updateDateButtons();
}
function updateThirdPair() {
  const enabled=$('#third-pair-enabled').checked;
  $('#third-pair-addons').hidden=!enabled;
  $('#third-pair-enabled').setAttribute('aria-expanded',String(enabled));
  $('#third-pair-hint').textContent=`${thirdPairRate(state.key)===null?'Rate needs review':fmt(thirdPairRate(state.key))+' per selected add-on'}. Separate from the first and second sets. Super Boost also earns this rate. Miyosmart is recorded for zero bonus.`;
  $('#third-pair-review').hidden=!legacyThirdPair || !enabled;
}
function updateNameWarning() {
  const input = $('#customer-name');
  const hasNumber = /\p{Nd}/u.test(input.value);
  input.classList.toggle('name-number-warning',hasNumber);
  input.setAttribute('aria-invalid',String(hasNumber));
  $('#customer-name-warning').hidden = !hasNumber;
}
$('#customer-name').addEventListener('change',updateNameWarning);
function updateDateButtons() {
  const value = $('#dispense-date').value;
  $('#previous-date').disabled = value === '1900-01-01';
  $('#next-date').disabled = value === '9999-12-31';
}
function rememberDate() {
  const value = $('#dispense-date').value;
  if (!editing && validDate(value)) {
    entryDate = value;
    try { sessionStorage.setItem(ENTRY_DATE_KEY, value); } catch { /* In-memory date still works. */ }
  }
  updateDateButtons();
}
$('#dispense-date').addEventListener('change', rememberDate);
for (const [id, days] of [['previous-date', -1], ['next-date', 1]]) $(`#${id}`).addEventListener('click', () => {
  const value = $('#dispense-date').value;
  $('#dispense-date').value = stepDate(validDate(value) ? value : entryDate, days);
  rememberDate();
});
function showView(view) {
  for (const name of ['entry', 'records']) {
    const selected = name === view;
    $(`#${name}-view`).hidden = !selected;
    $(`#tab-${name}`).setAttribute('aria-selected', String(selected));
    $(`#tab-${name}`).tabIndex = selected ? 0 : -1;
  }
}
for (const name of ['entry', 'records']) {
  $(`#tab-${name}`).onclick = () => showView(name);
  $(`#tab-${name}`).onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'entry' : event.key === 'End' ? 'records' : name === 'entry' ? 'records' : 'entry';
    showView(next); $(`#tab-${next}`).focus();
  };
}
function updatePreview() {
  const entry = readEntry();
  updateThirdPair();
  const result = calculate(entry,state.key);
  const selected = entry.types.length > 0;
  $('#bonus-preview').innerHTML = `<div class="bonus-line"><span>${result.cents === null && selected ? 'Bonus needs review':'Bonus for this dispense'}</span><strong>${!selected ? '—' : result.cents === null ? 'Pending' : fmt(result.cents)}</strong></div>${selected ? `<div class="breakdown">${result.parts.filter(p=>p.cents || p.free).map(p=>`<span>${escape(p.label)}${p.free ? ' (free under 241)' : ''} <b>${fmt(p.cents)}</b></span>`).join('') || 'No additional bonus selected.'}</div>${result.issues.length ? `<ul class="issue-list">${result.issues.map(s=>`<li>${escape(s)}</li>`).join('')}</ul>` : ''}` : '<p>Select a dispense type to get started.</p>'}`;
}
function dateText(date) { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00`)); }
function renderRecords() {
  const totals = summarise(state.entries,state.key);
  $('#total').textContent = fmt(totals.cents);
  $('#total-status').textContent = totals.pending ? '· confirmed' : '';
  $('#total-caption').textContent = totals.pending ? `${totals.pending} pending ${totals.pending===1?'record excluded':'records excluded'}` : '';
  $('#total-caption').hidden = !totals.pending;
  $('#count').textContent = state.entries.length;
  $('#record-badge').textContent = state.entries.length;
  $('#today-count').textContent = state.entries.filter(e=>e.date===localDate()).length;
  $('#export').disabled = !state.entries.length;
  const query = $('#search').value.trim().toLocaleLowerCase();
  const entries = state.entries.filter(e=>`${e.name} ${e.number}`.toLocaleLowerCase().includes(query)).slice().sort((a,b)=>b.date.localeCompare(a.date));
  $('#shown-count').textContent = `${entries.length} ${entries.length===1?'record':'records'}`;
  $('#footer-summary').textContent = `Total ${totals.pending?'confirmed bonus':'bonus'}: ${fmt(totals.cents)}`;
  if (!entries.length) {
    $('#records').innerHTML = `<div class="empty-state"><h3>${query?'No matching records':'No records yet'}</h3>${query?'<p>Try a different name or customer number.</p>':''}</div>`;
    return;
  }
  $('#records').innerHTML = `<div class="table-scroll"><table class="record-table"><thead><tr><th>Date / customer</th><th>Dispense details</th><th class="bonus-heading">Bonus</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${entries.map(entry=>{
    const result=calculate(entry,state.key);
    return `<tr><td><span class="record-date">${dateText(entry.date)}</span><strong class="customer-name">${escape(entry.name)}</strong><span class="customer-number">#${escape(entry.number)}</span></td><td><div class="record-tags">${entry.types.map(t=>`<span>${escape(t)}</span>`).join('')}<span class="set-tag">${entry.lensSets?'Lens sets':entry.set==='first'?'1st set':'2nd set'}</span></div><p class="record-addons">${escape(entry.lensSets ? ['first','second'].map(set => `${set==='first'?'1st':'2nd'}: ${[...entry.lensSets[set].addons,...entry.lensSets[set].offers].join(' + ') || 'No add-ons'}`).join(' · ') : entry.addons.join(' + ') || 'No add-ons')}</p>${entry.thirdPair?.enabled?`<p class="record-addons">3rd pair: ${escape(entry.thirdPair.addons.join(' + ') || 'No add-ons')}</p>`:''}${!entry.lensSets && entry.offers.length?`<p class="record-offers">${escape(entry.offers.join(' · '))}</p>`:''}${result.issues.length?`<details class="row-review"><summary>Review bonus</summary><ul>${result.issues.map(i=>`<li>${escape(i)}</li>`).join('')}</ul></details>`:''}</td><td class="row-bonus ${result.cents===null?'pending':''}">${result.cents===null?'Pending':fmt(result.cents)}</td><td class="row-actions"><button class="icon-button" data-action="edit" data-id="${entry.id}" aria-label="Edit ${escape(entry.name)}">${icon('edit')}</button><button class="icon-button danger" data-action="remove" data-id="${entry.id}" aria-label="Remove ${escape(entry.name)}">${icon('trash')}</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

$('#entry-form').addEventListener('input', event => {
  if (event.target.id === 'third-pair-enabled') updateThirdPair();
  if (event.target.name === 'name') updateNameWarning();
  if (event.target.name === 'set' && event.target.value !== activeLensSet) {
    captureLensSet();
    activeLensSet = event.target.value;
    showLensSet();
    showError($('#form-error'),'');
  }
  updatePreview();
});
$('#entry-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const entry = readEntry(); validateEntry(entry);
    if (editing && !equal(editingOriginal, state.entries.find(e => e.id === editing))) throw new Error('This record changed online while you were editing. Copy your changes, cancel this edit, then reopen the current record.');
    entry.id ||= crypto.randomUUID();
    const entries = editing ? state.entries.map(e=>e.id===editing?entry:e) : [...state.entries,entry];
    if (!commit({...state,entries})) return;
    rememberDate();
    notify(editing ? 'Record updated.' : 'Dispense saved on this device.');
    editing=null; fillEntry(); renderRecords();
    showView('entry');
    $('#entry-form').elements.number.focus({preventScroll:true});
    $('.form-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  } catch(error) { showError($('#form-error'),error.message); }
});
$('#cancel-edit').addEventListener('click',()=>{editing=null;fillEntry();});
$('#clear-entry').addEventListener('click',()=>{
  editing=null; editingOriginal=null;
  rememberDate(); fillEntry();
  $('#entry-form').elements.number.focus({preventScroll:true});
  $('.form-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
});
$('#search').addEventListener('input',renderRecords);
$('#records').addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]'); if(!button)return;
  const entry=state.entries.find(e=>e.id===button.dataset.id); if(!entry)return;
  if(button.dataset.action==='edit') {
    if (editing && editing!==entry.id && !confirm('Discard the current edit and open this record?')) return;
    editing=entry.id;editingOriginal=structuredClone(entry);showView('entry');fillEntry(entry);$('.form-panel').scrollIntoView({behavior:'smooth',block:'start'});$('#entry-form').elements.name.focus({preventScroll:true});
  } else if(confirm(`Remove the record for ${entry.name} (${entry.number})?`)) {
    if(!commit({...state,entries:state.entries.filter(e=>e.id!==entry.id)}))return;
    if(editing===entry.id){editing=null;fillEntry();}
    renderRecords();notify('Record removed.');
  }
});

function openKey() {
  keyOriginal = structuredClone(state.key);
  $('#key-content').innerHTML = `<label class="field currency-field">Currency<select name="currency"><option value="EUR" ${state.key.currency==='EUR'?'selected':''}>Euro (€)</option><option value="GBP" ${state.key.currency==='GBP'?'selected':''}>Pound (£)</option></select></label><p class="field-hint">Changing currency relabels amounts; it does not convert them.</p>${Object.entries(ACTIVE_BONUS_GROUPS).map(([group,labels])=>`<section class="key-section"><h3>${({types:'Paper-table columns',addons:'Add-ons',offers:'Special offers'})[group]}</h3>${group==='types'?'<p class="field-hint">Columns without a listed bonus use 0. Select all applicable paper columns.</p>':''}<div class="rate-head"><span>Item</span><span>1st set</span><span>2nd set</span></div>${labels.map(label=>{
    const id=ruleId(group,label),rate=state.key.rates[id];
    return `<div class="rate-row"><span>${escape(label)}</span>${['first','second'].map(set=>`<input aria-label="${escape(label)} ${set==='first'?'1st':'2nd'} set rate" name="${escape(`${id}:${set}`)}" type="number" min="0" max="10000" step="0.01" inputmode="decimal" placeholder="Unknown" value="${rate[set]===null?'':(rate[set]/100).toFixed(2)}">`).join('')}</div>${group==='offers'?`<label class="offer-mode">How this offer applies<select name="${escape(id)}:mode" aria-label="${escape(label)} calculation"><option value="">Needs confirmation</option>${Object.entries(MODES).map(([mode,text])=>`<option value="${mode}" ${rate.mode===mode?'selected':''}>${text}</option>`).join('')}</select></label>`:''}`;
  }).join('')}</section>`).join('')}<label class="field">Golden Ticket / third-pair rate per add-on<input name="thirdPairRate" type="number" min="0" max="10000" step="0.01" inputmode="decimal" value="${thirdPairRate(state.key)===null?'':(thirdPairRate(state.key)/100).toFixed(2)}"></label><div class="key-notes"><strong>How offers work</strong><p>With 241 selected, tick both frame prices on this record. Only the highest-priced frame earns a frame bonus. Each lens set has its own add-ons and offers; both sets are added to the record total. Under 241, second-set Elite, Tailormade and Supereader designs are free. Free Supereader includes one UCSC bonus; selecting 1.6, 1.67 or 1.74 replaces it with only that second-set index rate. Ticking UCSC as well never adds another coating bonus. Other add-ons keep their normal rates.</p><p>Both second-pair offers require single vision (SV) in the 2nd set; varifocals do not qualify for the flat rate. Golden Ticket and Third pair half price are one offer. Select its add-ons separately: each earns the third-pair rate, including Elite, Tailormade and Supereader. Normal lens rates, included UCSC and an extra base payment do not apply to the third pair. Super Boost earns the same third-pair rate. Miyosmart always earns zero. Under the second-pair SV offer, any add-ons automatically switch to one flat payment instead of the basic bonus and individual add-on rates. The supplied basic SV rate is €3; this can be corrected here if needed. The flat rate defaults to €5. Distinct replacement offers cannot be combined.</p><p>Combined add-ons are separate choices: choose Polaroid 1.6 instead of also selecting Polaroid and 1.6 for the same lens.</p></div><label class="field">Source / notes<textarea name="source" rows="3" maxlength="4000">${escape(state.key.source)}</textarea></label><label class="confirm-key"><input name="confirmed" type="checkbox" ${state.key.confirmed?'checked':''}><span>I have checked these rates and how the selected bonuses combine.</span></label>`;
  showError($('#key-error'),'');$('#key-dialog').showModal();
}
$('#open-key').addEventListener('click',openKey);
$('#close-key').addEventListener('click',()=>$('#key-dialog').close());
$('#cancel-key').addEventListener('click',()=>$('#key-dialog').close());
$('#key-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const data=new FormData(event.target),key=structuredClone(state.key);
    if (!equal(keyOriginal, state.key)) throw new Error('The bonus key changed online. Close and reopen this window before editing it.');
    key.thirdPairRate=parseRate(data.get('thirdPairRate'));
    key.currency=data.get('currency');key.confirmed=data.has('confirmed');key.source=data.get('source');
    for(const [group,labels]of Object.entries(ACTIVE_BONUS_GROUPS))for(const label of labels){
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
function updateExportFormat() {
  $('#download-export').innerHTML = `${icon('download')}Download ${$('#export-format').value === 'pdf' ? 'PDF' : 'Excel'}`;
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
$('#export-format').addEventListener('change',updateExportFormat);
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
    const snapshot=structuredClone(state),options=exportOptions(),selection=selectExport(snapshot,options),format=$('#export-format').value;
    const filename=exportFilename(selection,format),formatLabel=format === 'pdf' ? 'PDF' : 'Excel';
    if (!selection.entries.length) throw new Error('No records in this period. Choose different dates.');
    showError($('#export-error'),''); $('#refresh-export').hidden=true;
    exportBusy=true;button.disabled=true;button.textContent=`Preparing ${formatLabel}…`;
    // Keep the visible selection consistent with the snapshot while the file is generated.
    for (const input of $('#export-form').querySelectorAll('input,select')) input.disabled=true;
    const exporter = await loadExporter(format);
    const buffer = await exporter(snapshot,options);
    download(new Blob([buffer],{type:format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename);
    $('#export-dialog').close();
    notify(`${formatLabel} file prepared: ${periodLabel(selection)} · ${selection.entries.length} records.`);
  }catch(error){
    const loadFailed = error instanceof ExportLoadError;
    $('#refresh-export').hidden = !loadFailed;
    showError($('#export-error'),loadFailed
      ? 'The export tools could not load. This can happen after an app update or a connection problem. Check your connection, then tap Refresh app and try Export again. Your saved records will stay on this device.'
      : `Export failed: ${error.message}. Your records are still saved.`);
  }
  finally{
    exportBusy=false;button.disabled=false;updateExportFormat();
    for (const input of $('#export-form').querySelectorAll('input,select')) input.disabled=false;
    $('#export-start').disabled=$('#export-end').disabled=$('#export-preset').value==='all';
  }
});
const EXPORT_RECOVERY_KEY = 'dispensing-record:export-recovery';
$('#refresh-export').addEventListener('click',()=>{
  const draft=readEntry();
  if (draft.thirdPair?.enabled || editing || draft.number || draft.name || draft.types.length || Object.values(lensSetsOf(draft)).some(set=>set.addons.length || set.offers.length)) {
    showError($('#export-error'),'Cancel export and save or clear your unfinished dispense before refreshing. Your saved records are safe.');
    return;
  }
  if (cloud?.isBusy()) {
    showError($('#export-error'),'Online saving is still running. Wait for it to finish, then tap Refresh app again.');
    return;
  }
  try {
    // Only report preferences are carried across the refresh, never customer data.
    const preferences=Object.fromEntries(['format','preset','start','end','name'].map(name=>[name,$(`#export-${name}`).value]));
    sessionStorage.setItem(EXPORT_RECOVERY_KEY,JSON.stringify(preferences));
  } catch { /* Refresh remains available when session storage is blocked. */ }
  const url=new URL(location.href);
  url.searchParams.set('app-refresh',Date.now().toString());
  location.replace(url.href);
});
try {
  const preferences=JSON.parse(sessionStorage.getItem(EXPORT_RECOVERY_KEY) || 'null');
  sessionStorage.removeItem(EXPORT_RECOVERY_KEY);
  if (preferences && typeof preferences === 'object') {
    for (const name of ['format','preset','start','end','name']) {
      if (typeof preferences[name] === 'string') $(`#export-${name}`).value=preferences[name];
    }
    if (!$('#export-format').value) $('#export-format').value='xlsx';
    if (!$('#export-preset').value) $('#export-preset').value='month';
    $('#export-dates').hidden=$('#export-preset').value==='all';
    $('#export-start').disabled=$('#export-end').disabled=$('#export-preset').value==='all';
    updateExportFormat();
  }
} catch { /* Saved records do not depend on these optional preferences. */ }
if (new URL(location.href).searchParams.has('app-refresh')) {
  const url=new URL(location.href);url.searchParams.delete('app-refresh');
  history.replaceState(history.state,'',url.href);
}
function downloadBackup() { download(new Blob([JSON.stringify(documentOf(state),null,2)],{type:'application/json'}),`dispensing-backup-${localDate()}.json`); }
$('#backup').addEventListener('click',downloadBackup);
$('#raw-backup').addEventListener('click',()=>{
  try{download(new Blob([localStorage.getItem(STORAGE_KEY)||''],{type:'text/plain'}),'dispensing-stored-data.txt');}catch{notify('Browser storage is unavailable.');}
});
$('#restore').addEventListener('click',()=>$('#restore-file').click());
$('#restore-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if (cloud && !cloud.canEdit()) throw new Error('Sign in before restoring a backup.');
    if (cloud?.isBusy()) throw new Error('Wait for syncing to finish before restoring a backup.');
    if(file.size>10000000)throw new Error('Backup is too large (maximum 10 MB).');
    const restored=documentOf(validateState(JSON.parse(await file.text())));
    if(!confirm(`Replace the records and bonus key${state.cloud?' on this device and in your online account':' on this device'} with ${restored.entries.length} records from this backup? Download a backup first if needed.`))return;
    // Intentional replacement is also the recovery path for unreadable saved data.
    const expected=localStorage.getItem(STORAGE_KEY);
    ({state,raw}=saveState(localStorage,{...restored,...(state.cloud?{cloud:state.cloud}:{})},expected));storageError='';displayStorageError();editing=null;fillEntry();renderRecords();cloud?.changed();notify('Backup restored and saved on this device.');
  }catch(error){notify(`Could not restore backup: ${error.message}`);}
  finally{event.target.value='';}
});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)showError($('#storage-error'),'Records changed in another tab. Reload to see the latest records before saving.');});
displayStorageError();fillEntry();renderRecords();
cloud = installCloudUI({
  read: () => state,
  assertFresh: () => {
    if (storageError) throw new Error(storageError);
    if (localStorage.getItem(STORAGE_KEY) !== raw) throw new Error('Records changed in another tab. Reload before syncing.');
  },
  write: next => {
    if (storageError) throw new Error(storageError);
    ({ state, raw } = saveState(localStorage, next, raw));
    renderRecords(); updatePreview(); return state;
  },
  locked: value => {
    for (const selector of ['.stats', '.workspace', '.page-footer', '.view-toolbar', '#open-key']) $(selector).hidden = value;
    $('#locked-message').hidden = !value;
    if (value) for (const selector of ['#key-dialog', '#export-dialog']) $(selector).close();
  },
  backup: downloadBackup, notify,
});
