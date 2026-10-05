import { test, expect } from '@playwright/test';
import { openAccount, showRecords } from './ui-helpers.js';

async function save(page, name) {
  await page.getByLabel('Customer number', { exact: true }).fill('001');
  await page.getByLabel('Customer name', { exact: true }).fill(name);
  await page.locator('label').filter({ has: page.locator('input[value="SV"]') }).click();
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
