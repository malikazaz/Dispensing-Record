import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import { GROUPS, calculate, money } from './model.js';
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
      {text:'Bonus values are a snapshot at the time of export. Edit records or rates in the app and export again to recalculate.',fontSize:9,color:'#657a5a',margin:[0,10,0,0]},
    ],
  };
}

export async function exportPdf(state, options = {mode:'all'}) {
  return pdfMake.createPdf(pdfDefinition(state,options)).getBuffer();
}
