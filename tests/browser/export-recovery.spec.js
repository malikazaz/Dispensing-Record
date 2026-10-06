import { test, expect } from '@playwright/test';
import { initialState, blankEntry } from '../../src/model.js';
import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import { readPdf } from '../helpers/read-pdf.js';

async function seed(page) {
  const state=initialState();
  state.entries=Array.from({length:30},(_,i)=>({...blankEntry(),id:`sample-${i}`,date:'2026-10-05',name:'Example customer',number:`00${i}`,types:['Vari'],addons:['Elite']}));
  await page.goto('/');
  await page.evaluate(state=>localStorage.setItem('dispensing-record:v1',JSON.stringify(state)),state);
  await page.reload();
  return page.evaluate(()=>localStorage.getItem('dispensing-record:v1'));
}

for (const format of ['pdf','xlsx']) {
  test(`${format} loading failure recovers with a fresh page, retaining all records, key and export preferences`,async({page})=>{
    const original=await seed(page);
    // Emulate a tab requesting an export chunk deleted during deployment.
    const pattern=format==='pdf' ? '**/assets/pdf-*.js*' : '**/assets/workbook-*.js*';
    await page.route(pattern,route=>route.fulfill({status:404,contentType:'text/html',body:'Not found'}));
    await page.getByRole('button',{name:'Export records',exact:true}).click();
    await page.locator('#export-format').selectOption(format);
    await page.locator('#export-preset').selectOption('custom');
    await page.locator('#export-start').fill('2026-10-01');
    await page.locator('#export-end').fill('2026-10-31');
    await page.locator('#export-name').fill('October bonuses');
    await page.locator('#download-export').click();
    await expect(page.locator('#export-error')).toContainText('The export tools could not load');
    await expect(page.locator('#refresh-export')).toBeVisible();
    expect(await page.evaluate(()=>localStorage.getItem('dispensing-record:v1'))).toBe(original);
    await page.unroute(pattern);
    const refreshed=page.waitForRequest(request=>request.isNavigationRequest() && request.url().includes('app-refresh='));
    await page.locator('#refresh-export').click(); await refreshed;
    await expect(page.locator('#record-badge')).toHaveText('30');
    await expect(page.locator('#total')).toHaveText('€60.00');
    expect(await page.evaluate(()=>localStorage.getItem('dispensing-record:v1'))).toBe(original);
    await page.getByRole('button',{name:'Export records',exact:true}).click();
    await expect(page.locator('#export-format')).toHaveValue(format);
    await expect(page.locator('#export-preset')).toHaveValue('custom');
    await expect(page.locator('#export-start')).toHaveValue('2026-10-01');
    await expect(page.locator('#export-end')).toHaveValue('2026-10-31');
    await expect(page.locator('#export-name')).toHaveValue('October bonuses');
    await expect(page.locator('#refresh-export')).toBeHidden();
    const downloaded=page.waitForEvent('download');
    await page.locator('#download-export').click();
    const file=await downloaded;
    expect(file.suggestedFilename()).toBe(`dispensing-record-2026-10-01-to-2026-10-31.${format}`);
    if (format==='pdf') {
      const pages=await readPdf(await fs.readFile(await file.path()));
      const text=pages.map(page=>page.text).join(' ');
      expect(text).toContain('October bonuses');
      expect(text).toMatch(/TOTAL BONUS\s+€60.00/);
    } else {
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await file.path());
      expect(workbook.getWorksheet('Bonus period').getCell('Q35').value.result).toBe(60);
    }
    expect(await page.evaluate(()=>localStorage.getItem('dispensing-record:v1'))).toBe(original);
  });
}

test('export recovery never reloads over an unfinished dispense',async({page})=>{
  const original=await seed(page);
  await page.getByLabel('Customer name',{exact:true}).fill('Unfinished customer');
  await page.route('**/assets/pdf-*.js*',route=>route.abort());
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  await page.locator('#export-format').selectOption('pdf');
  await page.locator('#export-preset').selectOption('all');
  await page.locator('#download-export').click();
  await page.locator('#refresh-export').click();
  await expect(page.locator('#export-error')).toContainText('save or clear your unfinished dispense');
  await page.locator('#cancel-export').click();
  await expect(page.getByLabel('Customer name',{exact:true})).toHaveValue('Unfinished customer');
  expect(await page.evaluate(()=>localStorage.getItem('dispensing-record:v1'))).toBe(original);
});

test('a failed module is retried once with a fresh URL without resetting the open form',async({page})=>{
  const original=await seed(page);
  await page.getByLabel('Customer name',{exact:true}).fill('Unfinished customer');
  const requests=[];
  await page.route('**/assets/pdf-*.js*',route=>{
    const url=new URL(route.request().url());requests.push(url);
    return url.searchParams.has('retry') ? route.continue() : route.fulfill({status:404,body:'Not found'});
  });
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  await page.locator('#export-format').selectOption('pdf');
  await page.locator('#export-preset').selectOption('all');
  const downloaded=page.waitForEvent('download');
  await page.locator('#download-export').click();await downloaded;
  expect(requests).toHaveLength(2);
  expect(requests[1].searchParams.has('retry')).toBe(true);
  await expect(page.getByLabel('Customer name',{exact:true})).toHaveValue('Unfinished customer');
  expect(await page.evaluate(()=>localStorage.getItem('dispensing-record:v1'))).toBe(original);
});

test('a newer deployment requires refresh instead of importing another app version',async({page})=>{
  const original=await seed(page);
  await page.route('**/assets/pdf-*.js*',route=>route.abort());
  let latestCodeRequested=false;
  await page.route('**/export-manifest.json',route=>route.fulfill({json:{
    'index.html':{file:'assets/index-newer.js'},
    'src/pdf.js':{file:'assets/pdf-newer.js'},
  }}));
  await page.route('**/assets/pdf-newer.js*',route=>{latestCodeRequested=true;return route.abort();});
  await page.getByRole('button',{name:'Export records',exact:true}).click();
  await page.locator('#export-format').selectOption('pdf');
  await page.locator('#export-preset').selectOption('all');
  await page.locator('#download-export').click();
  await expect(page.locator('#refresh-export')).toBeVisible();
  expect(latestCodeRequested).toBe(false);
  expect(await page.evaluate(()=>localStorage.getItem('dispensing-record:v1'))).toBe(original);
});
