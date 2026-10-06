export const GROUPS = {
  types: ['SV', 'BIF', 'Vari', '241', 'Other', 'RE', '70', '95', '130', '160', '190', '240'],
  addons: ['UCSC', '1.6', '1.67', '1.74', 'Polaroid', 'Polaroid 1.6', 'Polaroid 1.67', 'Reaction', 'Reaction 1.67', 'Tint', 'Elite', 'Tailormade', 'Supereader', 'Super Boost'],
  offers: ['2nd pair SV', '2nd-pair add-ons', '3rd pair half-price combined with 2-4-1', 'Golden Ticket'],
};
export const RECORD_ONLY_ADDONS = ['Super Boost'];
export const BONUS_GROUPS = { ...GROUPS, addons: GROUPS.addons.filter(addon => !RECORD_ONLY_ADDONS.includes(addon)) };
export const MODES = { add: 'Add to bonus', replaceAddons: 'Replace add-ons (once)', perAddonReplace: 'Replace add-ons (per add-on)', perAddonAdd: 'Add extra (per add-on)', replaceTotal: 'Replace whole bonus' };
export const SOURCE = 'Bonus key and paper-table headings supplied directly by the user on 5 October 2026. Golden Ticket adds €1 per add-on to the normal bonus (latest correction). Under the second-pair offer, any add-ons replace the base and add-on bonuses with €5 total. Basic second-pair SV uses €3 from the full key; the later message expressed uncertainty between €3 and €2. Single-column and frame rates apply to both sets. Unpriced paper columns carry no additional bonus.';
export const ruleId = (group, label) => `${group}:${label}`;
export function defaultKey() {
  const addonRates = [[150,200],[300,350],[400,400],[500,500],[300,300],[400,400],[500,500],[200,200],[500,500],[100,100],[200,200],[250,250],[200,200]];
  const offers = { '2nd pair SV': [300,'replaceTotal'], '2nd-pair add-ons': [500,'replaceTotal'], '3rd pair half-price combined with 2-4-1': [200,'add'], 'Golden Ticket': [100,'perAddonAdd'] };
  return {
    currency: 'EUR', confirmed: true, source: SOURCE,
    rates: Object.fromEntries(Object.entries(BONUS_GROUPS).flatMap(([group, labels]) => labels.map(label => {
      const id = ruleId(group, label);
      const values = group === 'addons' ? addonRates[labels.indexOf(label)] : group === 'types' ? [label === '160' ? 150 : ['190','240'].includes(label) ? 300 : 0] : [offers[label][0]];
      return [id, { first: values[0], second: values[1] ?? values[0], mode: group === 'offers' ? offers[label][1] : 'add' }];
    }))),
  };
}
export const initialState = () => ({ version: 1, revision: '', entries: [], key: defaultKey() });
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function blankEntry() {
  return { id: '', date: localDate(), number: '', name: '', types: [], addons: [], offers: [], set: 'first' };
}
export function lensSetsOf(entry) {
  if (entry.lensSets) return structuredClone(entry.lensSets);
  const sets = { first: { addons: [], offers: [] }, second: { addons: [], offers: [] } };
  sets[entry.set] = { addons: [...entry.addons], offers: [...entry.offers] };
  return sets;
}
export function isFreeVarifocal(entry, addon) {
  return entry.set === 'second' && entry.types.includes('241') && ['Elite','Tailormade','Supereader'].includes(addon);
}
export function freeSupereader(entry) {
  return entry.addons.includes('Supereader') && isFreeVarifocal(entry,'Supereader');
}
export function supereaderIndexUpgrade(entry) {
  return freeSupereader(entry) && entry.addons.some(addon=>['1.6','1.67','1.74'].includes(addon));
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value && value >= '1900-01-01' && value <= '9999-12-31';
}
export function validateEntry(entry) {
  if (!entry || !validDate(entry.date)) throw new Error('Enter a valid date.');
  if (typeof entry.number !== 'string' || !entry.number.trim() || entry.number.length > 80) throw new Error('Enter a customer number (up to 80 characters).');
  if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 160) throw new Error('Enter a customer name (up to 160 characters).');
  if (!['first','second'].includes(entry.set)) throw new Error('Choose a lens set.');
  for (const [group, labels] of Object.entries(GROUPS)) {
    if (!Array.isArray(entry[group]) || entry[group].some(v => !labels.includes(v)) || new Set(entry[group]).size !== entry[group].length) throw new Error(`Invalid ${group} selection.`);
  }
  if (!entry.types.length) throw new Error('Choose at least one dispense type.');
  if (entry.lensSets !== undefined) {
    if (!entry.lensSets || typeof entry.lensSets !== 'object' || Array.isArray(entry.lensSets)) throw new Error('Invalid lens sets.');
    for (const set of ['first','second']) for (const group of ['addons','offers']) {
      const values = entry.lensSets[set]?.[group];
      if (!Array.isArray(values) || values.some(value => !GROUPS[group].includes(value)) || new Set(values).size !== values.length) throw new Error(`Invalid ${set}-set ${group}.`);
    }
  }
}
export function validateState(state) {
  if (!state || state.version !== 1 || typeof state.revision !== 'string' || !Array.isArray(state.entries) || state.entries.length > 10000) throw new Error('This is not a supported dispensing-record backup.');
  const key = state.key;
  if (!key || !['EUR','GBP'].includes(key.currency) || typeof key.confirmed !== 'boolean' || typeof key.source !== 'string' || key.source.length > 4000 || !key.rates) throw new Error('Invalid bonus key.');
  for (const [group, labels] of Object.entries(BONUS_GROUPS)) for (const label of labels) {
    const rate = key.rates[ruleId(group, label)];
    if (!rate || ![rate.first,rate.second].every(v => v === null || (Number.isSafeInteger(v) && v >= 0 && v <= 1000000))) throw new Error(`Invalid rate for ${label}.`);
    if (group === 'offers' ? ![null,...Object.keys(MODES)].includes(rate.mode) : rate.mode !== 'add') throw new Error(`Invalid rule for ${label}.`);
  }
  const ids = new Set();
  for (const entry of state.entries) {
    validateEntry(entry);
    if (typeof entry.id !== 'string' || !/^[\w-]{1,80}$/.test(entry.id) || ids.has(entry.id)) throw new Error('Invalid or duplicate record ID.');
    ids.add(entry.id);
  }
  return state;
}
export function calculate(entry, key) {
  if (!entry.lensSets) return calculateSet(entry,key);
  const results = ['first','second'].map(set => {
    const result = calculateSet({...entry, ...entry.lensSets[set], set}, key, set === 'second');
    return {
      ...result,
      parts: result.parts.map(part => ({ ...part, label: GROUPS.types.includes(part.label) ? part.label : `${set === 'first' ? '1st' : '2nd'} set · ${part.label}` })),
      issues: result.issues.map(issue => `${set === 'first' ? '1st' : '2nd'} set: ${issue}`),
    };
  });
  const parts = results.flatMap(result => result.parts);
  const issues = results.flatMap(result => result.issues);
  const offers = Object.values(entry.lensSets).flatMap(set => set.offers);
  if (offers.includes('3rd pair half-price combined with 2-4-1') && offers.some(offer => ['2nd pair SV','2nd-pair add-ons'].includes(offer))) issues.push('Second-pair and third-pair offers belong on separate records.');
  const subtotal = parts.reduce((sum,part) => sum + part.cents,0);
  return { cents: issues.length ? null : subtotal, subtotal, parts, issues };
}
function calculateSet(entry, key, skipTypes=false) {
  const issues = [];
  let bonusAddons = entry.addons.filter(addon => !RECORD_ONLY_ADDONS.includes(addon));
  if (freeSupereader(entry)) {
    // The free design has an included coating, not a separate design bonus.
    // An index upgrade replaces that coating bonus, even if UCSC was ticked.
    if (supereaderIndexUpgrade(entry)) bonusAddons=bonusAddons.filter(addon=>addon!=='UCSC');
    else if (!bonusAddons.includes('UCSC')) bonusAddons.push('UCSC');
  }
  const paidAddons = bonusAddons.filter(addon => !isFreeVarifocal(entry,addon));
  if (!entry.types.length) issues.push('Choose a dispense type.');
  if (!key.confirmed) issues.push('Check and confirm the bonus key.');
  // The second-pair SV offer becomes the single flat offer whenever add-ons are present.
  // Both checkboxes together must never award 3 + 5 or two flat payments.
  let effectiveOffers = [...entry.offers];
  if (effectiveOffers.includes('2nd pair SV') && (paidAddons.length || effectiveOffers.includes('2nd-pair add-ons'))) {
    effectiveOffers = effectiveOffers.filter(x => x !== '2nd pair SV');
    if (!effectiveOffers.includes('2nd-pair add-ons')) effectiveOffers.push('2nd-pair add-ons');
  }
  const selectedOffers = effectiveOffers.map(label => ({ label, ...key.rates[ruleId('offers',label)] }));
  const replacements = selectedOffers.filter(rate => ['replaceAddons','replaceTotal','perAddonReplace'].includes(rate.mode));
  if (replacements.length > 1) issues.push('Only one replacement offer can apply to a row. Split or review this combination.');
  const replace = replacements[0]?.mode;
  if (entry.offers.some(x => ['2nd pair SV','2nd-pair add-ons'].includes(x)) && entry.set !== 'second') issues.push('Second-pair offers require the 2nd lens set.');
  if (entry.offers.some(x => ['2nd pair SV','2nd-pair add-ons'].includes(x)) && (!entry.types.includes('SV') || entry.addons.some(addon => ['Elite','Tailormade','Supereader'].includes(addon)))) issues.push('Second-pair offers apply only to single vision, not varifocals.');
  if (entry.offers.includes('3rd pair half-price combined with 2-4-1') && !entry.types.includes('241')) issues.push('The 3rd-pair offer requires the 241 column.');
  if (entry.offers.includes('3rd pair half-price combined with 2-4-1') && entry.offers.some(x => ['2nd pair SV','2nd-pair add-ons'].includes(x))) issues.push('Second-pair and third-pair offers belong on separate records.');
  if (entry.offers.some(x => ['2nd-pair add-ons','Golden Ticket'].includes(x)) && !bonusAddons.length) issues.push('This offer requires at least one bonus-eligible add-on.');
  const parts = [];
  // 241 pays for the most expensive frame, irrespective of its bonus rate.
  const frames = entry.types.filter(label => ['70','95','130','160','190','240'].includes(label));
  const paidFrame = entry.types.includes('241') && frames.length ? String(Math.max(...frames.map(Number))) : null;
  for (const group of ['types','addons','offers']) {
    for (const label of group === 'offers' ? effectiveOffers : group === 'addons' ? bonusAddons : entry[group]) {
      if (skipTypes && group === 'types') continue;
      if (group === 'addons' && RECORD_ONLY_ADDONS.includes(label)) continue;
      if (group === 'types' && paidFrame && frames.includes(label) && label !== paidFrame) continue;
      if (group === 'addons' && isFreeVarifocal(entry,label)) {
        parts.push({label, cents:0, free:true});
        continue;
      }
      const rate = key.rates[ruleId(group,label)];
      const skipped = (replace === 'replaceTotal' && group !== 'offers') || (['replaceAddons','perAddonReplace'].includes(replace) && group === 'addons');
      if (skipped) continue;
      if (rate[entry.set] === null) issues.push(`${label}: ${entry.set === 'first' ? '1st' : '2nd'}-set rate missing.`);
      if (!rate.mode) issues.push(`${label}: choose how the offer applies.`);
      const partLabel=group==='addons' && label==='UCSC' && freeSupereader(entry) ? 'UCSC (included with Supereader)' : label;
      if (rate[entry.set] !== null && rate.mode) parts.push({ label:partLabel, cents: rate[entry.set] * (['perAddonReplace','perAddonAdd'].includes(rate.mode) ? paidAddons.length : 1) });
    }
  }
  const subtotal = parts.reduce((sum,p) => sum+p.cents,0);
  return { cents: issues.length ? null : subtotal, subtotal, parts, issues };
}
export function summarise(entries,key) {
  return entries.reduce((sum,entry) => {
    const result = calculate(entry,key);
    if (result.cents === null) sum.pending++;
    else sum.cents += result.cents;
    return sum;
  }, { cents: 0, pending: 0 });
}
export function money(cents, currency='EUR') {
  return new Intl.NumberFormat('en-GB',{ style:'currency',currency }).format(cents/100);
}
export function parseRate(text) {
  if (!text.trim()) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text.trim())) throw new Error('Rates must be positive amounts with at most two decimal places, or blank.');
  const cents = Math.round(Number(text)*100);
  if (cents > 1000000) throw new Error('A single bonus rate cannot exceed 10,000.');
  return cents;
}
