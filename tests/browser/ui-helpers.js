export async function openAccount(page) {
  if (await page.locator('#account-menu').isHidden()) await page.locator('#account-toggle').click();
}
export async function showRecords(page) { await page.locator('#tab-records').click(); }
export async function showEntry(page) { await page.locator('#tab-entry').click(); }
