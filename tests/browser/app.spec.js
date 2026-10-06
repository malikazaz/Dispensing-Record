import { openAccount, showRecords, showEntry } from './ui-helpers.js';
import { test,expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initialState, blankEntry } from '../../src/model.js';
import { readPdf } from '../helpers/read-pdf.js';
async function select(page,label){await page.locator('label').filter({has:page.locator(`input:not([name="thirdAddons"])[value="${label}"]`)}).click();}
async function startRecord(page,name='Alex Morgan',number='001234'){
  await showEntry(page);
  await page.getByLabel('Date',{exact:true}).fill('2026-10-05');
  await page.getByLabel('Customer number',{exact:true}).fill(number);
  await page.getByLabel('Customer name',{exact:true}).fill(name);
  await select(page,'SV');
}
test('save, persist, edit, export exact paper table and remove on desktop and mobile',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await showRecords(page);await expect(page.getByText('No records yet')).toBeVisible();
  await expect(page.locator('#export')).toBeDisabled();
  await startRecord(page);await select(page,'Polaroid');await select(page,'Elite');
  await expect(page.locator('#bonus-preview')).toContainText('€5.00');
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await expect(page.locator('#total')).toHaveText('€5.00');
  await page.reload();await expect(page.locator('#records')).toContainText('Alex Morgan');
  await showRecords(page);await page.getByRole('button',{name:'Edit Alex Morgan',exact:true}).click();
  await page.getByText('Special offers',{exact:false}).first().click();await page.locator('#third-pair-enabled').check();
  for(const value of ['Polaroid','Elite']) await page.locator(`input[name="thirdAddons"][value="${value}"]`).check();
  await expect(page.locator('#bonus-preview')).toContainText('€7.00');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.locator('#total')).toHaveText('€7.00');
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  await page.getByRole('combobox',{name:'Export period',exact:true}).selectOption('all');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download Excel',exact:true}).click();
  const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await download.path());
  const sheet=workbook.getWorksheet('Dispensing Record');expect(sheet.getCell('B5').value).toBe('001234');expect(sheet.getCell('Q5').value).toBe(7);
  expect(sheet.getRow(4).values.slice(1)).toEqual(['Date','Cust No','CX Name','SV','BIF','Vari','241','Other','RE','70','95','130','160','190','240','Addons','Bonus']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  page.once('dialog',dialog=>dialog.accept());await showRecords(page);await page.getByRole('button',{name:'Remove Alex Morgan',exact:true}).click();
  await expect(page.locator('#count')).toHaveText('0');await expect(page.locator('#total')).toHaveText('€0.00');
  expect(errors).toEqual([]);
});
test('second-pair SV with many add-ons pays one flat five euro bonus',async({page})=>{
  await page.goto('/');await startRecord(page);await select(page,'second');
  for(const addon of ['Polaroid','Reaction','Tint'])await select(page,addon);
  await page.locator('.offers summary').click();await select(page,'2nd pair SV');
  await expect(page.locator('#bonus-preview .bonus-line')).toContainText('€5.00');
  await select(page,'2nd-pair add-ons');await expect(page.locator('#bonus-preview .bonus-line')).toContainText('€5.00');
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();await expect(page.locator('#total')).toHaveText('€5.00');
});
test('bonus key changes persist and recalculate existing rows; blank rates remain pending',async({page})=>{
  await page.goto('/');await startRecord(page);await select(page,'Elite');await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await openAccount(page);await page.getByRole('button',{name:'Bonus key',exact:true}).click();
  await page.getByLabel('Elite 1st set rate',{exact:true}).fill('2.50');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Save bonus key',exact:true}).click();
  await expect(page.locator('#total')).toHaveText('€2.50');
  await openAccount(page);await page.getByRole('button',{name:'Bonus key',exact:true}).click();await page.getByLabel('Elite 1st set rate',{exact:true}).fill('');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Save bonus key',exact:true}).click();
  await expect(page.locator('#total-caption')).toHaveText('1 pending record excluded');await expect(page.locator('#records')).toContainText('Pending');
  await page.reload();await expect(page.locator('#total-caption')).toHaveText('1 pending record excluded');
});
test('JSON backup restores leading-zero IDs and rejects damaged data',async({page})=>{
  await page.goto('/');await startRecord(page);await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  const pending=page.waitForEvent('download');await openAccount(page);await page.getByRole('button',{name:'Download backup',exact:true}).click();const backup=await pending;
  const buffer=await fs.readFile(await backup.path());
  page.once('dialog',d=>d.accept());await showRecords(page);await page.getByRole('button',{name:'Remove Alex Morgan',exact:true}).click();
  page.once('dialog',d=>d.accept());await page.locator('#restore-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer});
  await expect(page.locator('#records')).toContainText('#001234');
  await page.locator('#restore-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(page.locator('#notice')).toContainText('Could not restore');await expect(page.locator('#count')).toHaveText('1');
});
test('stale tabs preserve newer records and warn before overwriting',async({page,context})=>{
  await page.goto('/');const other=await context.newPage();await other.goto('/');
  await startRecord(page);await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await startRecord(other,'Another customer','2');await other.getByRole('button',{name:'Save dispense',exact:true}).click();
  await expect(other.locator('#storage-error')).toContainText('Changes were not saved');
  await other.reload();await expect(other.locator('#count')).toHaveText('1');await expect(other.locator('#records')).toContainText('Alex Morgan');
});
test('production interface handles narrow screens and stores entered text without HTML execution',async({page},testInfo)=>{
  await page.goto('/');await startRecord(page,'<img src=x onerror=alert(1)>','00001');await select(page,'160');await select(page,'UCSC');
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();await expect(page.locator('#records img')).toHaveCount(0);
  await expect(page.locator('#records')).toContainText('<img src=x onerror=alert(1)>');
  if(testInfo.project.name==='mobile')await page.setViewportSize({width:320,height:740});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('capture review images with synthetic records',async({page},testInfo)=>{
  test.skip(!process.env.SCREENSHOT_DIR,'Optional visual review capture');
  await page.goto('/');
  for(const [name,no,addons,types]of [['Alex Morgan','001234',['Polaroid','Elite'],['160']],['Jamie Taylor','001235',['UCSC'],['190']],['Robin Ellis','001236',['Reaction'],[]]]){
    await startRecord(page,name,no);for(const type of types)await select(page,type);for(const addon of addons)await select(page,addon);await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  }
  await page.locator('#notice').evaluate(el=>el.hidden=true);await page.evaluate(()=>document.activeElement.blur());
  await fs.mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
  await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${testInfo.project.name}.png`),fullPage:true});
  await openAccount(page);await page.getByRole('button',{name:'Bonus key',exact:true}).click();await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${testInfo.project.name}-key.png`)});
});

test('custom period exports only inclusive dates as its own named section with a matching total',async({page},testInfo)=>{
  const state=initialState();
  state.entries=['2026-09-30','2026-10-01','2026-10-15','2026-10-31','2026-11-01'].map((date,index)=>({...blankEntry(),id:`range-${index}`,date,name:`Customer ${index}`,number:`000${index}`,types:['SV'],addons:['Elite']}));
  // A pending row in the period is listed but excluded from its confirmed total.
  state.entries.push({...blankEntry(),id:'pending',date:'2026-10-10',name:'Pending customer',number:'0005',types:['SV'],offers:['2nd pair SV']});
  await page.goto('/');await page.evaluate(data=>localStorage.setItem('dispensing-record:v1',JSON.stringify(data)),state);await page.reload();
  // A record-list search must not silently narrow the bonus claim.
  await showRecords(page);await page.getByRole('searchbox').fill('Customer 0');
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  await page.getByRole('combobox',{name:'Export period',exact:true}).selectOption('custom');
  await page.getByLabel('Start date',{exact:true}).fill('2026-10-01');await page.getByLabel('End date',{exact:true}).fill('2026-10-31');
  await page.getByLabel('Section name',{exact:false}).fill('October bonuses');
  await expect(page.locator('#export-summary')).toContainText('4 records');await expect(page.locator('#export-summary')).toContainText('€6.00');
  await expect(page.locator('#export-summary')).toContainText('1 pending record');
  expect(await page.locator('#export-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${testInfo.project.name}-export.png`)});
  const pendingDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download Excel',exact:true}).click();
  const file=await pendingDownload;expect(file.suggestedFilename()).toBe('dispensing-record-2026-10-01-to-2026-10-31.xlsx');
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(await file.path());const sheet=book.getWorksheet('Bonus period');
  expect(sheet.getCell('A1').value).toBe('October bonuses');expect(sheet.getCell('A3').value).toContain('01/10/2026 – 31/10/2026');
  expect([5,6,7,8].map(row=>sheet.getCell(`B${row}`).value)).toEqual(['0001','0005','0002','0003']);
  expect(sheet.getCell('Q9').value).toEqual({formula:'SUM(Q5:Q8)',result:6});
  expect(book.worksheets).toHaveLength(2);await expect(page.locator('#count')).toHaveText('6');
  await expect(page.locator('#total')).toHaveText('€10.00');
});

test('custom export rejects reversed, incomplete and empty periods; cancellation retains records',async({page})=>{
  await page.goto('/');await startRecord(page);await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  await page.getByRole('combobox',{name:'Export period',exact:true}).selectOption('custom');
  await page.getByLabel('Start date',{exact:true}).fill('2026-10-31');await page.getByLabel('End date',{exact:true}).fill('2026-10-01');
  await expect(page.locator('#export-error')).toContainText('on or after');await expect(page.locator('#download-export')).toBeDisabled();
  await page.getByLabel('Start date',{exact:true}).fill('');await expect(page.locator('#download-export')).toBeDisabled();
  await page.getByLabel('Start date',{exact:true}).fill('2026-09-01');await page.getByLabel('End date',{exact:true}).fill('2026-09-30');
  await expect(page.locator('#export-summary')).toContainText('No records');await expect(page.locator('#download-export')).toBeDisabled();
  await page.getByLabel('Start date',{exact:true}).fill('2026-10-05');await page.getByLabel('End date',{exact:true}).fill('2026-10-05');
  await expect(page.locator('#export-summary')).toContainText('1 record');await expect(page.locator('#download-export')).toBeEnabled();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('#count')).toHaveText('1');
  await page.getByRole('button',{name:'Export records',exact:true}).click();await expect(page.getByLabel('Start date',{exact:true})).toHaveValue('2026-10-05');
  await page.getByRole('combobox',{name:'Export period',exact:true}).selectOption('all');await expect(page.locator('#export-dates')).toBeHidden();await expect(page.locator('#download-export')).toBeEnabled();
});

test('PDF download uses the chosen period and section, while Excel remains available',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const state=initialState();state.entries=['2026-09-30','2026-10-01','2026-10-31','2026-11-01'].map((date,i)=>({...blankEntry(),id:`pdf-${i}`,date,number:`009${i}`,name:`PDF Customer ${i}`,types:['SV'],addons:['Polaroid','Elite']}));
  await page.goto('/');await page.evaluate(data=>localStorage.setItem('dispensing-record:v1',JSON.stringify(data)),state);await page.reload();
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  await page.getByRole('combobox',{name:'File format',exact:true}).selectOption('pdf');
  await page.getByRole('combobox',{name:'Export period',exact:true}).selectOption('custom');
  await page.getByLabel('Start date',{exact:true}).fill('2026-10-01');await page.getByLabel('End date',{exact:true}).fill('2026-10-31');
  await page.getByLabel('Section name',{exact:false}).fill('October PDF bonuses');
  await expect(page.locator('#export-summary')).toContainText('€10.00');
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${testInfo.project.name}-pdf-dialog.png`)});
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();
  const file=await waiting;expect(file.suggestedFilename()).toBe('dispensing-record-2026-10-01-to-2026-10-31.pdf');
  const buffer=await fs.readFile(await file.path());const pages=await readPdf(buffer);const text=pages.map(p=>p.text).join(' ');
  expect(text).toContain('October PDF bonuses');expect(text).toContain('TOTAL BONUS');expect(text).toContain('€10.00');
  expect(text).toContain('0091');expect(text).toContain('0092');expect(text).not.toContain('0090');expect(text).not.toContain('0093');
  await expect(page.locator('#count')).toHaveText('4');
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  await page.getByRole('combobox',{name:'File format',exact:true}).selectOption('xlsx');await expect(page.getByRole('button',{name:'Download Excel',exact:true})).toBeEnabled();
  expect(errors).toEqual([]);
});
