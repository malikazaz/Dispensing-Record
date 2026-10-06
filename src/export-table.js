import { GROUPS, isFreeVarifocal, freeSupereader, supereaderIndexUpgrade } from './model.js';

export const PAPER_HEADERS = ['Date','Cust No','CX Name',...GROUPS.types,'Addons','Bonus'];

export function recordDetails(entry,result) {
  const addonsText = (set,addons) => {
    const lens={...entry,set,addons};
    return addons.map(addon=>{
      if (addon==='Supereader' && freeSupereader(lens) && !supereaderIndexUpgrade(lens)) return 'Supereader (free under 241; includes UCSC)';
      if (addon==='UCSC' && supereaderIndexUpgrade(lens)) return 'UCSC (included in index upgrade)';
      return `${addon}${isFreeVarifocal(lens,addon) ? ' (free under 241)' : ''}`;
    }).join(' + ') || 'No add-ons';
  };
  if (entry.lensSets) return [...['first','second'].flatMap(set => [`${set==='first'?'1st':'2nd'} set of lenses: ${addonsText(set,entry.lensSets[set].addons)}`, ...entry.lensSets[set].offers.map(offer => `${set==='first'?'1st':'2nd'} set offer: ${offer}`)]), ...result.issues.map(issue=>`REVIEW: ${issue}`)].join('\n');
  return [entry.set==='first'?'1st set of lenses':'2nd set of lenses', addonsText(entry.set,entry.addons), ...entry.offers.map(offer=>`Offer: ${offer}`), ...result.issues.map(issue=>`REVIEW: ${issue}`)].join('\n');
}
