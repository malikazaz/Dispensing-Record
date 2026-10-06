import { claimsOf, unclaimedEntries } from './claims.js';
import { localDate, summarise, validDate } from './model.js';

export function monthPeriod(preset, today = localDate()) {
  if (!validDate(today)) throw new Error('Invalid current date.');
  let [year, month] = today.split('-').map(Number);
  if (preset === 'previous-month') {
    month--;
    if (!month) { year--; month = 12; }
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31][month-1];
  const prefix = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}`;
  return { start: `${prefix}-01`, end: `${prefix}-${days}` };
}

export function selectExport(state, options = { mode: 'all' }) {
  if (options.claimId) {
    const claim=claimsOf(state).find(item=>item.id===options.claimId);
    if (!claim || !['draft','submitted'].includes(claim.status)) throw new Error('This claim is no longer available for export.');
    return {entries:claim.rows.map(row=>row.entry),rows:claim.rows,total:{cents:claim.total,pending:0},currency:claim.currency,name:claim.name,mode:'claim',claim};
  }
  if (!['all','custom'].includes(options.mode)) throw new Error('Choose an export period.');
  const name = (options.name ?? '').trim();
  if (name.length > 80) throw new Error('Use a section name of 80 characters or fewer.');
  if (options.mode === 'custom') {
    if (!validDate(options.start) || !validDate(options.end)) throw new Error('Choose a valid start and end date.');
    if (options.start > options.end) throw new Error('The end date must be on or after the start date.');
  }
  // ISO calendar dates compare directly: both boundary days are included, without timezone conversion.
  const entries = unclaimedEntries(state).filter(entry => options.mode === 'all' || (entry.date >= options.start && entry.date <= options.end));
  return { currency:state.key.currency, entries, total: summarise(entries,state.key), name, mode: options.mode, start: options.start, end: options.end };
}

export function exportFilename(selection, format = 'xlsx') {
  if (!['xlsx','pdf'].includes(format)) throw new Error('Choose Excel or PDF.');
  if (selection.mode === 'claim') return `claim-${selection.claim.id}.${format}`;
  return selection.mode === 'custom'
    ? `dispensing-record-${selection.start}-to-${selection.end}.${format}`
    : `dispensing-record-all-${localDate()}.${format}`;
}

export function periodLabel(selection) {
  if (selection.mode === 'claim') return `Claim ${selection.claim.id} | Prepared ${selection.claim.history[0].at.slice(0,10)}`;
  if (selection.mode === 'all') return 'All unclaimed records';
  const format = value => { const [year,month,day] = value.split('-'); return `${day}/${month}/${year}`; };
  return `Bonus period: ${format(selection.start)} – ${format(selection.end)} (inclusive)`;
}
