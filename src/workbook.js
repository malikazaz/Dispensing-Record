import ExcelJS from 'exceljs';
import { GROUPS, BONUS_GROUPS, MODES, calculate, money, ruleId } from './model.js';
import { selectExport, periodLabel } from './export-selection.js';
import { PAPER_HEADERS, recordDetails } from './export-table.js';

export { PAPER_HEADERS } from './export-table.js';
const ink='FF244F43', light='FFEAF1E6', border='FFD5DFD1';
function title(sheet,range,text) {
  sheet.mergeCells(range);const cell=sheet.getCell(range.split(':')[0]);cell.value=text;
  cell.font={name:'Calibri',size:20,bold:true,color:{argb:ink}};cell.alignment={vertical:'middle'};
}
function header(row) {
  row.height=28;
  row.eachCell(cell=>{cell.font={name:'Calibri',size:10,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ink}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};});
}
function bodyCell(cell) {
  cell.font={name:'Calibri',size:10,color:{argb:'FF324436'}};
  cell.alignment={vertical:'middle',wrapText:true};
  cell.border={bottom:{style:'thin',color:{argb:border}},left:{style:'hair',color:{argb:border}},right:{style:'hair',color:{argb:border}}};
}
export function makeWorkbook(state, options = { mode: 'all' }) {
  const selection = selectExport(state, options);
  const workbook=new ExcelJS.Workbook();
  workbook.creator='Dispensing Record';workbook.created=new Date();workbook.calcProperties.fullCalcOnLoad=true;
  const currency=state.key.currency==='EUR'?'€':'£';
  const currencyFormat=`"${currency}"#,##0.00;[Red]("${currency}"#,##0.00);"${currency}"0.00`;
  const total=selection.total;
  const sheet=workbook.addWorksheet(selection.mode === 'custom' ? 'Bonus period' : 'Dispensing Record',{
    views:[{state:'frozen',xSplit:3,ySplit:4,showGridLines:false}],
    pageSetup:{paperSize:8,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,margins:{left:.25,right:.25,top:.35,bottom:.35,header:.15,footer:.15}},
    headerFooter:{oddFooter:'&LDispensing Record&CPage &P of &N&RPrivate customer records'},
  });
  sheet.columns=[{width:12},{width:14},{width:27},...GROUPS.types.map(()=>({width:5.5})),{width:55},{width:14}];
  title(sheet,'A1:Q1',selection.name || (selection.mode === 'custom' ? 'BONUS PERIOD' : 'DISPENSING RECORD'));sheet.getRow(1).height=selection.name.length > 50 ? 60 : 39;
  sheet.getCell('A1').alignment={vertical:'middle',wrapText:true};
  sheet.mergeCells('A2:Q2');sheet.getCell('A2').value=`${selection.entries.length} records  •  ${total.pending?'Confirmed bonus':'Total bonus'}: ${money(total.cents,state.key.currency)}${total.pending?`  •  ${total.pending} pending records excluded from total`:''}`;
  sheet.getCell('A2').font={name:'Calibri',size:11,color:{argb:ink}};sheet.getRow(2).height=25;
  sheet.mergeCells('A3:Q3');sheet.getCell('A3').value=`${periodLabel(selection)}. Lens set and special offers appear in Addons. Bonus values reflect the exported key.`;
  sheet.getCell('A3').font={name:'Calibri',size:10,color:{argb:'FF6C7C65'}};sheet.getRow(3).height=23;
  sheet.getRow(4).values=PAPER_HEADERS;header(sheet.getRow(4));
  const entries=selection.entries.slice().sort((a,b)=>a.date.localeCompare(b.date));
  for(const [index,entry]of entries.entries()) {
    const result=calculate(entry,state.key),addonText=recordDetails(entry,result);
    const row=sheet.getRow(index+5);
    row.values=[new Date(`${entry.date}T00:00:00Z`),entry.number,entry.name,...GROUPS.types.map(type=>entry.types.includes(type)?'✓':''),addonText,result.cents===null?'Pending':result.cents/100];
    row.height=Math.max(42,addonText.split('\n').reduce((lines,line)=>lines+Math.max(1,Math.ceil(line.length/49)),0)*13+10,Math.ceil(entry.name.length/25)*13+10,Math.ceil(entry.number.length/13)*13+10);
    row.eachCell({includeEmpty:true},cell=>{bodyCell(cell);if(index%2===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF6F8F3'}};});
    row.getCell(1).numFmt='dd/mm/yyyy';row.getCell(2).numFmt='@';
    for(let column=4;column<=15;column++)row.getCell(column).alignment={vertical:'middle',horizontal:'center'};
    row.getCell(17).numFmt=currencyFormat;row.getCell(17).alignment={horizontal:'right',vertical:'middle'};
    row.getCell(17).font={name:'Calibri',size:12,bold:true,color:{argb:result.cents===null?'FF9A7028':ink}};
  }
  const last=entries.length+4,totalRow=last+1;
  sheet.mergeCells(`A${totalRow}:P${totalRow}`);sheet.getCell(`A${totalRow}`).value=total.pending?`TOTAL CONFIRMED BONUS (${total.pending} records pending)`:'TOTAL';
  sheet.getCell(`Q${totalRow}`).value=entries.length?{formula:`SUM(Q5:Q${last})`,result:total.cents/100}:0;
  sheet.getCell(`Q${totalRow}`).numFmt=currencyFormat;sheet.getRow(totalRow).height=32;
  sheet.getRow(totalRow).eachCell(cell=>{cell.font={name:'Calibri',size:12,bold:true,color:{argb:ink}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:light}};cell.alignment={vertical:'middle',horizontal:cell.col===17?'right':'left'};});
  if(entries.length)sheet.autoFilter={from:'A4',to:`Q${last}`};
  sheet.pageSetup.printArea=`A1:Q${totalRow}`;sheet.pageSetup.printTitlesRow='1:4';

  const key=workbook.addWorksheet('Bonus key',{views:[{state:'frozen',ySplit:4,showGridLines:false}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  key.columns=[{width:18},{width:45},{width:14},{width:14},{width:33}];
  title(key,'A1:E1','BONUS KEY');key.getRow(1).height=38;
  key.mergeCells('A2:E2');key.getCell('A2').value=`Currency: ${state.key.currency}. Key ${state.key.confirmed?'confirmed':'not confirmed'}. Rates and offer rules at the time of export.`;key.getRow(2).height=23;
  key.getRow(4).values=['Category','Item','1st set','2nd set','Calculation'];header(key.getRow(4));
  let r=5;
  for(const [group,labels]of Object.entries(BONUS_GROUPS))for(const label of labels){
    const rate=state.key.rates[ruleId(group,label)],row=key.getRow(r++);
    row.values=[{types:'Paper column',addons:'Add-on',offers:'Special offer'}[group],label,rate.first===null?'Unknown':rate.first/100,rate.second===null?'Unknown':rate.second/100,MODES[rate.mode]||'Needs confirmation'];
    row.eachCell(bodyCell);row.getCell(3).numFmt=currencyFormat;row.getCell(4).numFmt=currencyFormat;row.height=label.length>35?36:24;
  }
  for(const note of [
    'Under 241, second-set Elite, Tailormade and Supereader are recorded as free and earn no bonus. Other add-ons retain their usual rates. Second-pair flat offers require SV, not varifocals. Golden Ticket counts paid add-ons only, including paid third-pair varifocals.',
    'Records with both lens sets add each set separately. Shared frame bonuses are counted once using first-set rates. A second-pair flat offer replaces only the second-set amount; first-set and shared frame bonuses remain. Golden Ticket applies to its selected set.',
    'Second-pair SV: with no add-ons, use its basic rate. With any add-ons, use the second-pair flat rate once, replacing the base, frame and individual add-on amounts. Selecting both second-pair offers still pays the flat rate only once.',
    'Golden Ticket adds its rate for each selected add-on. Combined choices (for example Polaroid 1.6) count as one selected add-on. The 3rd-pair offer requires 241 and cannot share a record with second-pair offers.',
    'Unpriced paper columns are markers with zero bonus. Single-column add-on and frame rates apply to both lens sets. With 241 selected, only the highest-priced selected frame earns a frame bonus. Lens add-ons are calculated separately. Choose only the options actually purchased.',
    'Excel bonuses are exported snapshots, not recalculating entry forms. Edit records or rates in the app and export again. The TOTAL cell is a SUM formula with a cached result. Pending records are excluded, never treated as a confirmed zero.',
    `Source: ${state.key.source}`,
  ]) {
    r++;key.mergeCells(`A${r}:E${r}`);const cell=key.getCell(`A${r}`);cell.value=note;cell.font={name:'Calibri',size:10,color:{argb:'FF657A5A'}};cell.alignment={wrapText:true,vertical:'middle'};key.getRow(r).height=Math.max(34,Math.ceil(note.length/145)*15+12);
  }
  key.pageSetup.printArea=`A1:E${r}`;
  return workbook;
}
export async function exportWorkbook(state, options = { mode: 'all' }) {
  return makeWorkbook(state, options).xlsx.writeBuffer();
}
