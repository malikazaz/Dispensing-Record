import ExcelJS from 'exceljs';
import { GROUPS, calculate, money } from './model.js';
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
  const currency=selection.currency==='EUR'?'€':'£';
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
  sheet.mergeCells('A2:Q2');sheet.getCell('A2').value=`${selection.entries.length} records  •  ${total.pending?'Confirmed bonus':'Total bonus'}: ${money(total.cents,selection.currency)}${total.pending?`  •  ${total.pending} pending records excluded from total`:''}`;
  sheet.getCell('A2').font={name:'Calibri',size:11,color:{argb:ink}};sheet.getRow(2).height=25;
  sheet.mergeCells('A3:Q3');sheet.getCell('A3').value=`${periodLabel(selection)}. Lens set and special offers appear in Addons. Bonus values are a snapshot at the time of export.`;
  sheet.getCell('A3').font={name:'Calibri',size:10,color:{argb:'FF6C7C65'}};sheet.getRow(3).height=23;
  sheet.getRow(4).values=PAPER_HEADERS;header(sheet.getRow(4));
  const entries=selection.entries.slice().sort((a,b)=>a.date.localeCompare(b.date));
  for(const [index,entry]of entries.entries()) {
    const saved=selection.rows?.find(row=>row.entry.id===entry.id);
    const result=saved?{cents:saved.cents,issues:[]}:calculate(entry,state.key),addonText=saved?.details ?? recordDetails(entry,result);
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

  return workbook;
}
export async function exportWorkbook(state, options = { mode: 'all' }) {
  return makeWorkbook(state, options).xlsx.writeBuffer();
}
