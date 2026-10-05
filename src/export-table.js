import { GROUPS } from './model.js';

export const PAPER_HEADERS = ['Date','Cust No','CX Name',...GROUPS.types,'Addons','Bonus'];

export function recordDetails(entry,result) {
  return [entry.set==='first'?'1st set of lenses':'2nd set of lenses', entry.addons.length ? entry.addons.join(' + ') : 'No add-ons', ...entry.offers.map(offer=>`Offer: ${offer}`), ...result.issues.map(issue=>`REVIEW: ${issue}`)].join('\n');
}
