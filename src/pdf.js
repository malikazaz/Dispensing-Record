import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import { GROUPS, MODES, calculate, money, ruleId } from './model.js';
import { selectExport, periodLabel } from './export-selection.js';
import { PAPER_HEADERS, recordDetails } from './export-table.js';

pdfMake.addVirtualFileSystem(pdfFonts);
// Reports contain local text only. No font, image or document URL may be fetched.
pdfMake.setUrlAccessPolicy(() => false);
const GREEN = '#244f43';
const layout = {
  hLineWidth: () => 0.5, vLineWidth: () => 0.5,
  hLineColor: () => '#d5dfd1', vLineColor: () => '#d5dfd1',
  paddingLeft: () => 5, paddingRight: () => 5,
  paddingTop: () => 7, paddingBottom: () => 7,
};
const headerCell = text => ({ text, bold: true, color: '#ffffff', fillColor: GREEN, alignment: 'center' });
const dateText = value => { const [year,month,day] = value.split('-'); return `${day}/${month}/${year}`; };
const spanRow = (text, columns) => [{ text, colSpan: columns }, ...Array.from({length: columns-1},() => ({}))];

export function pdfDefinition(state, options = {mode:'all'}) {
  const selection = selectExport(state, options);
  const title = selection.name || (selection.mode === 'custom' ? 'BONUS PERIOD' : 'DISPENSING RECORD');
  const period = periodLabel(selection).replaceAll('–','-');
  const totalText = selection.total.pending ? 'TOTAL CONFIRMED BONUS' : 'TOTAL BONUS';
  const body = [PAPER_HEADERS.map(headerCell)];
  for (const [index,entry] of selection.entries.slice().sort((a,b) => a.date.localeCompare(b.date)).entries()) {
    const result = calculate(entry,state.key);
    const values = [dateText(entry.date),entry.number,entry.name,...GROUPS.types.map(type => entry.types.includes(type) ? 'X' : ''),recordDetails(entry,result),result.cents === null ? 'Pending' : money(result.cents,state.key.currency)];
    body.push(values.map((text,column) => ({
      text, fillColor: index % 2 ? '#f5f8f2' : '#ffffff',
      alignment: column === 16 ? 'right' : column >= 3 && column <= 14 ? 'center' : 'left',
      ...(column === 16 ? {bold:true,color:result.cents === null ? '#91611e' : GREEN} : {}),
    })));
  }
  if (!selection.entries.length) body.push(spanRow('No records in this period.',17));
  body.push([
    {text:totalText,colSpan:16,bold:true,fillColor:'#eaf1e6'},
    ...Array.from({length:15},() => ({})),
    {text:money(selection.total.cents,state.key.currency),alignment:'right',bold:true,fillColor:'#eaf1e6',color:GREEN},
  ]);
  const keyBody = [['Category','Item','1st set','2nd set','Calculation'].map(headerCell)];
  for (const [group,labels] of Object.entries(GROUPS)) for (const label of labels) {
    const rate = state.key.rates[ruleId(group,label)];
    keyBody.push([
      {types:'Paper column',addons:'Add-on',offers:'Special offer'}[group],label,
      rate.first === null ? 'Unknown' : money(rate.first,state.key.currency),
      rate.second === null ? 'Unknown' : money(rate.second,state.key.currency),
      MODES[rate.mode] || 'Needs confirmation',
    ]);
  }
  return {
    pageSize:'A3',pageOrientation:'landscape',pageMargins:[28,45,28,38],
    info:{title,author:'Dispensing Record',subject:period,creator:'Dispensing Record'},
    defaultStyle:{font:'Roboto',fontSize:9,color:'#324436',lineHeight:1.15},
    header: {text:`Dispensing Record  |  ${period}`,margin:[28,17,28,0],fontSize:9,color:'#657a5a'},
    footer: (page,pages) => ({columns:[{text:'Private customer records'},{text:`Page ${page} of ${pages}`,alignment:'right'}],margin:[28,12,28,0],fontSize:8,color:'#657a5a'}),
    content:[
      {text:title,fontSize:22,bold:true,color:GREEN,margin:[0,0,0,9]},
      {text:period,fontSize:11,color:GREEN,margin:[0,0,0,6]},
      {text:`${selection.entries.length} ${selection.entries.length === 1 ? 'record' : 'records'}  |  ${selection.total.pending ? 'Confirmed bonus' : 'Total bonus'}: ${money(selection.total.cents,state.key.currency)}`,fontSize:12,bold:true,margin:[0,0,0,6]},
      ...(selection.total.pending ? [{text:`${selection.total.pending} pending records are listed but excluded from the confirmed total. Review their bonus rules in the app.`,color:'#91611e',margin:[0,0,0,7]}] : []),
      {text:'X marks a selected paper column. Lens set and special offers are included in Addons.',fontSize:9,color:'#657a5a',margin:[0,0,0,12]},
      {table:{headerRows:1,keepWithHeaderRows:1,dontBreakRows:true,widths:[60,65,140,...GROUPS.types.map(() => 26),'*',82],body},layout},
      {text:'Bonus values are a snapshot of the key below. Edit records or rates in the app and export again to recalculate.',fontSize:9,color:'#657a5a',margin:[0,10,0,0]},
      {text:'BONUS KEY',pageBreak:'before',fontSize:22,bold:true,color:GREEN,margin:[0,0,0,10]},
      {text:`Currency: ${state.key.currency}. Key ${state.key.confirmed ? 'confirmed' : 'not confirmed'}. Rates at the time of export.`,margin:[0,0,0,12]},
      {table:{headerRows:1,keepWithHeaderRows:1,dontBreakRows:true,widths:[100,280,100,100,'*'],body:keyBody},layout:{...layout,paddingTop:()=>4,paddingBottom:()=>4}},
      {text:'Second-pair SV with any add-ons uses the single second-pair flat rate instead of the basic, frame and individual add-on bonuses. Selecting both second-pair offers never pays twice. Golden Ticket applies its per-add-on amount in addition to the normal bonus under the supplied key.',margin:[0,12,0,6],fontSize:9},
      {text:'Combined add-on choices count once. Unpriced paper columns carry no additional bonus. Pending amounts are not confirmed zero bonuses.',margin:[0,0,0,6],fontSize:9},
      {text:`Source / notes: ${state.key.source}`,fontSize:9,color:'#657a5a'},
    ],
  };
}

export async function exportPdf(state, options = {mode:'all'}) {
  return pdfMake.createPdf(pdfDefinition(state,options)).getBuffer();
}
