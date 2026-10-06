import { test, expect } from '@playwright/test';
import { openAccount, showRecords } from './ui-helpers.js';

test('Super Boost follows Supereader, survives saving, and leaves the bonus key usable', async ({ page }) => {
  await page.goto('/');
  const select = value => page.locator('label').filter({has:page.locator(`input:not([name="thirdAddons"])[value="${value}"]`)}).click();
  expect(await page.locator('input[name="addons"]').evaluateAll(inputs=>inputs.map(input=>input.value))).toEqual(expect.arrayContaining(['Supereader','Super Boost']));
  await expect(page.locator('input[name="addons"]').last()).toHaveValue('Super Boost');
  await page.getByLabel('Customer number', { exact: true }).fill('001');
  await page.getByLabel('Customer name', { exact: true }).fill('Record only');
  for(const value of ['SV','Super Boost','second','Super Boost']) await select(value);
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€0.00');
  await page.getByRole('button', { name: 'Save dispense', exact: true }).click();
  await page.reload(); await expect(page.locator('#count')).toHaveText('1');
  await expect(page.locator('#total')).toHaveText('€0.00');
  await showRecords(page); await expect(page.locator('#records')).toContainText('Super Boost');
  await page.getByRole('button', { name: 'Edit Record only', exact: true }).click();
  await expect(page.locator('input:not([name="thirdAddons"])[value="Super Boost"]')).toBeChecked();
  await select('first'); await expect(page.locator('input:not([name="thirdAddons"])[value="Super Boost"]')).toBeChecked();
  await openAccount(page); await page.getByRole('button',{name:'Bonus key',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Save bonus key',exact:true}).click();
  await expect(page.locator('#key-dialog')).toBeHidden(); await expect(page.locator('#total')).toHaveText('€0.00');
});

test('241 keeps both varifocals but credits one, including after reload and editing', async ({ page }) => {
  await page.goto('/');
  const select = value => page.locator('label').filter({has:page.locator(`input:not([name="thirdAddons"])[value="${value}"]`)}).click();
  await page.getByLabel('Customer number', { exact: true }).fill('001');
  await page.getByLabel('Customer name', { exact: true }).fill('Varifocal example');
  for(const value of ['Vari','241','Elite','1.74','second','Elite']) await select(value);
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€7.00');
  await expect(page.locator('#bonus-preview .breakdown')).toContainText('2nd set · Elite (free under 241) €0.00');
  await page.getByRole('button', { name: 'Save dispense', exact: true }).click();
  await page.reload(); await expect(page.locator('#total')).toHaveText('€7.00');
  await showRecords(page); await page.getByRole('button', { name: 'Edit Varifocal example', exact: true }).click();
  await expect(page.locator('input:not([name="thirdAddons"])[value="Elite"]')).toBeChecked();
  await select('first'); await expect(page.locator('input:not([name="thirdAddons"])[value="Elite"]')).toBeChecked();
  await select('241'); await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€9.00');
  await expect(page.locator('#bonus-preview .breakdown')).not.toContainText('free under 241');
  await select('241'); await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('#count')).toHaveText('1'); await expect(page.locator('#total')).toHaveText('€7.00');
});

test('free Supereader earns included UCSC or index upgrade without stacking and survives saving', async ({ page }) => {
  await page.goto('/');
  const select = value => page.locator('label').filter({has:page.locator(`input:not([name="thirdAddons"])[value="${value}"]`)}).click();
  await page.getByLabel('Customer number', { exact: true }).fill('001');
  await page.getByLabel('Customer name', { exact: true }).fill('Supereader example');
  for(const value of ['Vari','241','Supereader','1.74','second','Supereader']) await select(value);
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€9.00');
  await expect(page.locator('#bonus-preview .breakdown')).toContainText('2nd set · UCSC (included with Supereader) €2.00');
  await expect(page.locator('#bonus-preview .breakdown')).toContainText('Supereader (free under 241) €0.00');
  await select('UCSC');await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€9.00');
  for(const [index,total] of [['1.6','€10.50'],['1.67','€11.00'],['1.74','€12.00']]) {
    await select(index);await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText(total);
    await expect(page.locator('#bonus-preview .breakdown')).not.toContainText('UCSC');
    await select(index);
  }
  await select('1.6');
  await page.getByRole('button', { name: 'Save dispense', exact: true }).click();
  await page.reload(); await expect(page.locator('#total')).toHaveText('€10.50');
  await showRecords(page); await page.getByRole('button', { name: 'Edit Supereader example', exact: true }).click();
  await expect(page.locator('input:not([name="thirdAddons"])[value="Supereader"]')).toBeChecked();
  await expect(page.locator('input:not([name="thirdAddons"])[value="1.6"]')).toBeChecked();
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€10.50');
});

test('switching lens sets keeps independent choices and saves both in one record', async ({ page }) => {
  await page.goto('/');
  const select = value => page.locator('label').filter({has:page.locator(`input:not([name="thirdAddons"])[value="${value}"]`)}).click();
  await page.getByLabel('Customer number', { exact: true }).fill('001');
  await page.getByLabel('Customer name', { exact: true }).fill('Two sets');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-05');
  for(const value of ['241','160','190','UCSC']) await select(value);
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€4.50');
  await select('second');
  await expect(page.locator('input:not([name="thirdAddons"])[value="UCSC"]')).not.toBeChecked();
  await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue('Two sets');
  await expect(page.getByLabel('Date', { exact: true })).toHaveValue('2026-10-05');
  await select('UCSC');
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€6.50');
  await page.locator('.offers summary').click(); await page.locator('#third-pair-enabled').check(); await page.locator('input[name="thirdAddons"][value="Tint"]').check();
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€7.50');
  await select('first');
  await expect(page.locator('input:not([name="thirdAddons"])[value="UCSC"]')).toBeChecked();
  await expect(page.locator('#third-pair-enabled')).toBeChecked();
  await select('second');
  await expect(page.locator('#third-pair-enabled')).toBeChecked();
  await page.locator('#third-pair-enabled').uncheck();
  await page.getByRole('button', { name: 'Save dispense', exact: true }).click();
  await expect(page.locator('#count')).toHaveText('1');
  await expect(page.locator('input:not([name="thirdAddons"])[value="UCSC"]')).not.toBeChecked();
  await select('second'); await expect(page.locator('input:not([name="thirdAddons"])[value="UCSC"]')).not.toBeChecked();
  await page.reload(); await expect(page.locator('#total')).toHaveText('€6.50');
  await showRecords(page); await page.getByRole('button', { name: 'Edit Two sets', exact: true }).click();
  await expect(page.locator('input:not([name="thirdAddons"])[value="UCSC"]')).toBeChecked();
  await select('first'); await expect(page.locator('input:not([name="thirdAddons"])[value="UCSC"]')).toBeChecked();
  await select('UCSC');
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€5.00');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('#count')).toHaveText('1');
  await expect(page.locator('#total')).toHaveText('€5.00');
});

test('241 pays only for the higher frame and preserves both frame ticks after saving', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Customer number', { exact: true }).fill('001');
  await page.getByLabel('Customer name', { exact: true }).fill('Frame example');
  for (const value of ['241','160','190']) {
    await page.locator('label').filter({ has: page.locator(`input[name="types"][value="${value}"]`) }).click();
  }
  await expect(page.locator('#bonus-preview .bonus-line strong')).toHaveText('€3.00');
  await expect(page.locator('#bonus-preview .breakdown')).not.toContainText('160');
  await page.getByRole('button', { name: 'Save dispense', exact: true }).click();
  await page.reload();
  await expect(page.locator('#total')).toHaveText('€3.00');
  await showRecords(page);
  await page.getByRole('button', { name: 'Edit Frame example', exact: true }).click();
  for (const value of ['241','160','190']) await expect(page.locator(`input[name="types"][value="${value}"]`)).toBeChecked();
});

async function save(page, name) {
  await page.getByLabel('Customer number', { exact: true }).fill('001');
  await page.getByLabel('Customer name', { exact: true }).fill(name);
  await page.locator('label').filter({ has: page.locator('input:not([name="thirdAddons"])[value="SV"]') }).click();
  await page.getByRole('button', { name: 'Save dispense', exact: true }).click();
}
test('batch entry keeps its date, steps days, and returns to the top of a cleared form', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#records-view')).toBeHidden();
  await expect(page.locator('.page-heading')).toHaveCount(0);
  const date = page.getByLabel('Date', { exact: true });
  await date.fill('2024-02-28');
  await save(page, 'First');
  await expect(date).toHaveValue('2024-02-28');
  await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue('');
  await expect.poll(() => page.locator('.form-panel').evaluate(el => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(24);
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(date).toHaveValue('2024-02-29'); await save(page, 'Second');
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(date).toHaveValue('2024-03-01');
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(date).toHaveValue('2024-02-29');
  await page.reload(); await expect(date).toHaveValue('2024-02-29');
  await showRecords(page); await page.getByRole('button', { name: 'Edit First', exact: true }).click();
  await expect(date).toHaveValue('2024-02-28');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(date).toHaveValue('2024-02-29');
  await expect(page.locator('#count')).toHaveText('2');
});
test('account controls stay in the header menu and dismiss with Escape or outside click', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#account-menu')).toBeHidden();
  await openAccount(page); await expect(page.getByRole('button', { name: 'Bonus key', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download backup', exact: true })).toBeVisible();
  const bounds = await page.locator('#account-menu').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.keyboard.press('Escape'); await expect(page.locator('#account-menu')).toBeHidden();
  await expect(page.locator('#account-toggle')).toBeFocused();
  await openAccount(page); await page.locator('.brand').click(); await expect(page.locator('#account-menu')).toBeHidden();
});
