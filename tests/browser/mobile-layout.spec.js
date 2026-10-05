import {test,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

async function checkFields(page,selector) {
  const fields=await page.locator(selector).evaluateAll(inputs=>inputs.map(input=>{
    const rect=input.getBoundingClientRect(),parent=input.closest('.field').getBoundingClientRect(),style=getComputedStyle(input);
    return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height,parentLeft:parent.left,parentRight:parent.right,font:parseFloat(style.fontSize)};
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
    expect(Math.abs(first.width-second.width)).toBeLessThanOrEqual(1);
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
  await page.locator('label').filter({has:page.locator('input[value="SV"]')}).click();
  if(process.env.SCREENSHOT_DIR){
    await fs.mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
    await page.locator('.form-panel').screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${testInfo.project.name}-fields.png`)});
  }
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await expect(page.locator('#records')).toContainText('#001234');
  await page.getByRole('button',{name:'Edit Layout check',exact:true}).click();
  await expect(page.getByLabel('Date',{exact:true})).toHaveValue('2026-09-30');
});

test('custom export date fields stay inside the dialog without overlapping',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Customer number',{exact:true}).fill('0001');
  await page.getByLabel('Customer name',{exact:true}).fill('Export layout');
  await page.locator('label').filter({has:page.locator('input[value="SV"]')}).click();
  await page.getByRole('button',{name:'Save dispense',exact:true}).click();
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  for(const width of [320,390,430,768]){
    await page.setViewportSize({width,height:844});
    await checkFields(page,'#export-dates input');
    expect(await page.locator('#export-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
});
