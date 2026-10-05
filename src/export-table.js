import { GROUPS, isFreeVarifocal } from './model.js';

export const PAPER_HEADERS = ['Date','Cust No','CX Name',...GROUPS.types,'Addons','Bonus'];

export function recordDetails(entry,result) {
  const addonsText = (set,addons) => addons.map(addon => `${addon}${isFreeVarifocal({...entry,set},addon) ? ' (free under 241)' : ''}`).join(' + ') || 'No add-ons';
  if (entry.lensSets) return [...['first','second'].flatMap(set => [`${set==='first'?'1st':'2nd'} set of lenses: ${addonsText(set,entry.lensSets[set].addons)}`, ...entry.lensSets[set].offers.map(offer => `${set==='first'?'1st':'2nd'} set offer: ${offer}`)]), ...result.issues.map(issue=>`REVIEW: ${issue}`)].join('\n');
  return [entry.set==='first'?'1st set of lenses':'2nd set of lenses', addonsText(entry.set,entry.addons), ...entry.offers.map(offer=>`Offer: ${offer}`), ...result.issues.map(issue=>`REVIEW: ${issue}`)].join('\n');
}
