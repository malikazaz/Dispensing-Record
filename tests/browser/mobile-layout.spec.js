import { openAccount, showRecords, showEntry } from './ui-helpers.js';
import {test,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

async function checkFields(page,selector) {
  const fields=await page.locator(selector).evaluateAll(inputs=>inputs.map(input=>{
    const rect=input.getBoundingClientRect(),parent=input.closest('.field').getBoundingClientRect(),style=getComputedStyle(input);
    return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height,parentLeft:parent.left,parentRight:parent.right,parentWidth:parent.width,font:parseFloat(style.fontSize)};
  }));
  expect(fields).toHaveLength(2);
  for(const field of fields){
    expect(field.left).toBeGreaterThanOrEqual(field.parentLeft-1);
    expect(field.right).toBeLessThanOrEqual(field.parentRight+1);
    expect(field.width).toBeGreaterThan(100);
  }
  const [first,second]=fields;
  expect(first.right<=second.left-5 || first.bottom<=second.top-5).toBe(true);
  expect(Math.abs(first.height-second.height)).toBeLessThanOrEqual(1);
  if(page.viewportSize().width<=540){
    expect(first.bottom).toBeLessThan(second.top);
    expect(Math.abs(first.parentWidth-second.parentWidth)).toBeLessThanOrEqual(1);
    for(const field of fields){expect(field.height).toBe(48);expect(field.font).toBeGreaterThanOrEqual(16);}
  }
}

test('date and customer number fit their own fields at phone, tablet and desktop widths',async({page},testInfo)=>{
  await page.goto('/');
  await page.getByLabel('Date',{exact:true}).fill('2026-09-30');
  await page.getByLabel('Customer number',{exact:true}).fill('001234567890123456789012345678901234567890');
  for(const width of [320,375,390,430,540,768,1280]){
    await page.setViewportSize({width,height:844});
    await checkFields(page,'#entry-form .two-col input');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByLabel('Customer number',{exact:true}).fill('001234');
  await page.getByLabel('Customer name',{exact:true}).fill('Layout check');
  await page.locator('label').filter({has:page.locator('input:not([name="thirdAddons"])[value="SV"]')}).click();
  if(process.env.SCREENSHOT_DIR){
    await fs.mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
    await page.locator('.form-panel').screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${testInfo.project.name}-fields.png`)});
  }
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await expect(page.locator('#records')).toContainText('#001234');
  await showRecords(page);await page.getByRole('button',{name:'Edit Layout check',exact:true}).click();
  await expect(page.getByLabel('Date',{exact:true})).toHaveValue('2026-09-30');
});

test('custom export date fields stay inside the dialog without overlapping',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Customer number',{exact:true}).fill('0001');
  await page.getByLabel('Customer name',{exact:true}).fill('Export layout');
  await page.locator('label').filter({has:page.locator('input:not([name="thirdAddons"])[value="SV"]')}).click();
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  for(const width of [320,390,430,768]){
    await page.setViewportSize({width,height:844});
    await checkFields(page,'#export-dates input');
    expect(await page.locator('#export-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
});

test('tabs fill their bar evenly on large phones and fit narrow screens',async({page})=>{
 await page.goto('/');
 for(const width of [320,375,390,430,440,540,600,768]){
  await page.setViewportSize({width,height:956});await page.locator('#tab-claims').click();
  const layout=await page.locator('.view-tabs').evaluate(bar=>({bar:bar.getBoundingClientRect().toJSON(),buttons:[...bar.children].map(button=>{const range=document.createRange();range.selectNodeContents(button);return {rect:button.getBoundingClientRect().toJSON(),text:range.getBoundingClientRect().toJSON()};})}));
  const [first,,last]=layout.buttons;
  expect(Math.abs(first.rect.width-last.rect.width)).toBeLessThanOrEqual(1);
  expect(layout.bar.right-last.rect.right).toBeLessThanOrEqual(5);
  for(const button of layout.buttons){expect(button.text.left).toBeGreaterThanOrEqual(button.rect.left);expect(button.text.right).toBeLessThanOrEqual(button.rect.right);expect(button.rect.height).toBeGreaterThanOrEqual(44);}
  await expect(page.locator('#tab-claims')).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});


test('summary privacy persists through reloads and does not change saved records', async ({page, context}) => {
 await page.goto('/');
 await page.getByLabel('Customer number',{exact:true}).fill('0007');
 await page.getByLabel('Customer name',{exact:true}).fill('Privacy example');
 await page.locator('input[name=types][value=SV]').check({force:true});
 await page.locator('input[name=addons][value=Elite]').check({force:true});
 await page.locator('#save-entry').click();
 const saved = await page.evaluate(()=>localStorage.getItem('dispensing-record:v1'));
 await expect(page.locator('#total')).toHaveText('€2.00');
 await openAccount(page);
 await page.getByRole('button',{name:'Hide summaries',exact:true}).click();
 await expect(page.locator('#bonus-summary')).toBeHidden();
 await expect(page.locator('#summary-toggle')).toHaveAttribute('aria-expanded','false');
 await page.reload();
 await expect(page.locator('#cloud-status')).toContainText('Saved on this device only');
 await expect(page.locator('#bonus-summary')).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem('dispensing-record:v1'))).toBe(saved);
 const second=await context.newPage();
 try {
  await second.goto('/');
  await expect(second.locator('#bonus-summary')).toBeHidden();
  await openAccount(second);
  await second.getByRole('button',{name:'Show summaries',exact:true}).click();
  await expect(second.locator('#total')).toBeVisible();
  await expect(page.locator('#total')).toBeVisible();
 } finally { await second.close(); }
 await page.reload();
 await expect(page.locator('#total')).toBeVisible();
 await expect(page.locator('#total')).toHaveText('€2.00');
});
