import { test,expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
async function select(page,label){await page.locator('label').filter({has:page.locator(`input[value="${label}"]`)}).click();}
async function startRecord(page,name='Alex Morgan',number='001234'){
  await page.getByLabel('Date',{exact:true}).fill('2026-10-05');
  await page.getByLabel('Customer number',{exact:true}).fill(number);
  await page.getByLabel('Customer name',{exact:true}).fill(name);
  await select(page,'SV');
}
test('save, persist, edit, export exact paper table and remove on desktop and mobile',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByText('A fresh page for your day')).toBeVisible();
  await expect(page.locator('#export')).toBeDisabled();
  await startRecord(page);await select(page,'Polaroid');await select(page,'Elite');
  await expect(page.locator('#bonus-preview')).toContainText('€5.00');
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await expect(page.locator('#total')).toHaveText('€5.00');
  await page.reload();await expect(page.locator('#records')).toContainText('Alex Morgan');
  await page.getByRole('button',{name:'Edit Alex Morgan',exact:true}).click();
  await page.getByText('Special offers',{exact:false}).first().click();await select(page,'Golden Ticket');
  await expect(page.locator('#bonus-preview')).toContainText('€7.00');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.locator('#total')).toHaveText('€7.00');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel',exact:true}).click();
  const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await download.path());
  const sheet=workbook.getWorksheet('Dispensing Record');expect(sheet.getCell('B5').value).toBe('001234');expect(sheet.getCell('Q5').value).toBe(7);
  expect(sheet.getRow(4).values.slice(1)).toEqual(['Date','Cust No','CX Name','SV','BIF','Vari','241','Other','RE','70','95','130','160','190','240','Addons','Bonus']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Remove Alex Morgan',exact:true}).click();
  await expect(page.locator('#count')).toHaveText('0');await expect(page.locator('#total')).toHaveText('€0.00');
  expect(errors).toEqual([]);
});
test('second-pair SV with many add-ons pays one flat five euro bonus',async({page})=>{
  await page.goto('/');await startRecord(page);await select(page,'second');
  for(const addon of ['Polaroid','Reaction','Elite'])await select(page,addon);
  await page.locator('.offers summary').click();await select(page,'2nd pair SV');
  await expect(page.locator('#bonus-preview .bonus-line')).toContainText('€5.00');
  await select(page,'2nd-pair add-ons');await expect(page.locator('#bonus-preview .bonus-line')).toContainText('€5.00');
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();await expect(page.locator('#total')).toHaveText('€5.00');
});
test('bonus key changes persist and recalculate existing rows; blank rates remain pending',async({page})=>{
  await page.goto('/');await startRecord(page);await select(page,'Elite');await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await page.getByRole('button',{name:'Bonus key',exact:true}).click();
  await page.getByLabel('Elite 1st set rate',{exact:true}).fill('2.50');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Save bonus key',exact:true}).click();
  await expect(page.locator('#total')).toHaveText('€2.50');
  await page.getByRole('button',{name:'Bonus key',exact:true}).click();await page.getByLabel('Elite 1st set rate',{exact:true}).fill('');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Save bonus key',exact:true}).click();
  await expect(page.locator('#total-caption')).toHaveText('1 pending record excluded');await expect(page.locator('#records')).toContainText('Pending');
  await page.reload();await expect(page.locator('#total-caption')).toHaveText('1 pending record excluded');
});
test('JSON backup restores leading-zero IDs and rejects damaged data',async({page})=>{
  await page.goto('/');await startRecord(page);await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup',exact:true}).click();const backup=await pending;
  const buffer=await fs.readFile(await backup.path());
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove Alex Morgan',exact:true}).click();
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
  await page.getByRole('button',{name:'Bonus key',exact:true}).click();await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${testInfo.project.name}-key.png`)});
});
