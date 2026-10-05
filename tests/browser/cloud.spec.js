import { test, expect } from '@playwright/test';
import { initialState, blankEntry } from '../../src/model.js';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const base = 'https://dispensing-test.supabase.co';
const item = (id, name) => ({ ...blankEntry(), id, name, number: '001234', types: ['SV'], addons: ['Elite'] });
function session(id = owner) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id, email: id === owner ? 'tester@example.com' : 'other@example.com', aud: 'authenticated', role: 'authenticated' };
  const part = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  return { access_token: `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: id, role: 'authenticated', exp: expires })}.test`, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expires, user };
}
async function mock(context, server = { row: null, fail: false }, userSession = null, local = null) {
  if (userSession || local) await context.addInitScript(({ userSession, local }) => {
    if (sessionStorage.getItem('seeded')) return;
    if (userSession) localStorage.setItem('dispensing-record:auth:v1', JSON.stringify(userSession));
    if (local) localStorage.setItem('dispensing-record:v1', JSON.stringify(local));
    sessionStorage.setItem('seeded', 'yes');
  }, { userSession, local });
  await context.route('**/cloud-config.json', route => route.fulfill({ json: { url: base, publishableKey: 'sb_publishable_test' } }));
  await context.route(`${base}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: session(request.postDataJSON()?.email === 'other@example.com' ? other : owner) });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: session().user });
    if (url.pathname === '/auth/v1/recover') return route.fulfill({ json: {} });
    if (url.pathname === '/rest/v1/dispensing_members') return route.fulfill({ json: [{ user_id: owner }] });
    if (url.pathname !== '/rest/v1/dispensing_documents') return route.fulfill({ status: 404, json: { message: 'Unexpected test request' } });
    if (request.method() === 'GET') return route.fulfill({ json: server.row ? [server.row] : [] });
    if (server.fail) return route.fulfill({ status: 503, json: { message: 'Database unavailable' } });
    const payload = request.postDataJSON();
    if (request.method() === 'POST' && server.row) return route.fulfill({ status: 409, json: { code: '23505' } });
    if (request.method() === 'PATCH' && Number(url.searchParams.get('version')?.slice(3)) !== server.row?.version) return route.fulfill({ json: null });
    server.row = { payload: payload.payload, version: payload.version };
    return route.fulfill({ json: server.row });
  });
  return server;
}
async function login(page, email = 'tester@example.com') {
  await page.locator('#cloud-login').click(); await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('test-password-123'); await page.locator('#login-submit').click();
}
async function add(page, name = 'New customer') {
  await page.getByLabel('Customer number', { exact: true }).fill('00012');
  await page.getByLabel('Customer name', { exact: true }).fill(name);
  await page.locator('input[name=types][value=SV]').check({ force: true });
  await page.locator('#save-entry').click();
}

test('sign in, explicitly migrate local data and key, then restore on a fresh browser', async ({ page, context, browser }) => {
  const local = { ...initialState(), entries: [item('old', 'Existing customer')] }; local.key.currency = 'GBP';
  const server = await mock(context, undefined, null, local);
  await page.goto('/'); await login(page);
  await expect(page.locator('#cloud-connect')).toBeVisible(); expect(server.row).toBe(null);
  await page.locator('#cloud-connect').click(); await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.');
  expect(server.row.payload.key.currency).toBe('GBP');
  await add(page); await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.');
  expect(server.row.payload.entries).toHaveLength(2);
  const fresh = await browser.newContext();
  try {
    await mock(fresh, server, session()); const restored = await fresh.newPage(); await restored.goto('http://127.0.0.1:4173/');
    await expect(restored.locator('#cloud-status')).toHaveText('Saved online and on this device.');
    await expect(restored.locator('#records')).toContainText('Existing customer'); await expect(restored.locator('#count')).toHaveText('2');
    await expect(restored.locator('#total')).toContainText('£');
  } finally { await fresh.close(); }
});

test('failed upload survives reload, retries and includes bonus-key changes and removals', async ({ page, context }) => {
  const server = await mock(context, undefined, session()); await page.goto('/');
  await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.'); server.fail = true;
  await add(page, 'Offline customer'); await expect(page.locator('#cloud-status')).toContainText('Not saved online yet');
  await page.reload(); await expect(page.locator('#records')).toContainText('Offline customer');
  await expect(page.locator('#cloud-status')).toContainText('Not saved online yet');
  server.fail = false; await page.locator('#cloud-sync').click(); await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.');
  await page.locator('#open-key').click(); await page.getByLabel('Elite 1st set rate', { exact: true }).fill('4.50');
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Save bonus key', exact: true }).click();
  await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.'); expect(server.row.payload.key.rates['addons:Elite'].first).toBe(450);
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Remove Offline customer' }).click();
  await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.'); expect(server.row.payload.entries).toHaveLength(0);
});

test('sign out hides cached records and another account cannot inherit them', async ({ page, context }) => {
  const server = await mock(context, { row: { payload: { ...initialState(), entries: [item('a', 'Private customer')] }, version: 1 }, fail: false }, session());
  await page.goto('/'); await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.');
  await page.locator('#cloud-signout').click(); await expect(page.locator('.workspace')).toBeHidden();
  await page.reload(); await expect(page.locator('.workspace')).toBeHidden();
  await login(page, 'other@example.com'); await expect(page.locator('#cloud-status')).toContainText('different account');
  await expect(page.locator('.workspace')).toBeHidden(); expect(server.row.payload.entries).toHaveLength(1);
});

test('conflicting record edits require review and preserve the chosen version', async ({ page, context }) => {
  const server = await mock(context, { row: { payload: { ...initialState(), entries: [item('a', 'Original')] }, version: 1 }, fail: false }, session());
  await page.goto('/'); await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.');
  await page.getByRole('button', { name: 'Edit Original', exact: true }).click();
  await page.getByLabel('Customer name', { exact: true }).fill('Device version');
  server.row.payload.entries[0].name = 'Online version'; server.row.version++;
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('#cloud-review')).toBeVisible(); await page.locator('#cloud-review').click();
  await expect(page.locator('#conflict-items')).toContainText('Device version'); await expect(page.locator('#conflict-items')).toContainText('Online version');
  await page.locator('#conflict-remote').click(); await expect(page.locator('#cloud-status')).toHaveText('Saved online and on this device.');
  await expect(page.locator('#records')).toContainText('Online version'); expect(server.row.payload.entries[0].name).toBe('Online version');
});

test('login and cloud panel fit narrow phone screens without overlap', async ({ page, context }) => {
  await mock(context); await page.goto('/'); await page.locator('#cloud-login').click();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('#login-submit')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const email = await page.locator('#login-email').boundingBox(); const password = await page.locator('#login-password').boundingBox();
    expect(email.x).toBeGreaterThanOrEqual(0); expect(email.x + email.width).toBeLessThanOrEqual(width);
    expect(password.y).toBeGreaterThan(email.y + email.height);
  }
});
