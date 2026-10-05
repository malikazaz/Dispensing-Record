import { CloudSync, documentOf, validateLink } from './cloud-model.js';
import { loadCloudConfig, createCloudClient, cloudAdapter } from './cloud-client.js';
import { recordDetails } from './export-table.js';

export function installCloudUI({ read, write, locked, backup, notify, assertFresh }) {
  const $ = selector => document.querySelector(selector);
  const host = document.createElement('section');
  host.className = 'cloud-panel'; host.setAttribute('aria-label', 'Online saving');
  host.innerHTML = `<div><strong>Online saving</strong><p id="cloud-status" role="status">Checking online settings…</p><p id="cloud-account" class="field-hint"></p></div>
    <div class="cloud-actions"><button id="cloud-login" class="button secondary" hidden>Sign in</button><button id="cloud-connect" class="button primary" hidden>Connect and upload</button><button id="cloud-sync" class="button secondary" hidden>Sync now</button><button id="cloud-review" class="button secondary" hidden>Review changes</button><button id="cloud-signout" class="link-button" hidden>Sign out</button></div>`;
  $('#account-menu').append(host, $('#open-key'), $('.page-footer'));
  function setAccountOpen(open, focus = false) {
    $('#account-menu').hidden = !open;
    $('#account-toggle').setAttribute('aria-expanded', String(open));
    if (focus) $('#account-toggle').focus({preventScroll:true});
  }
  $('#account-toggle').onclick = () => setAccountOpen($('#account-menu').hidden);
  document.addEventListener('click', event => {
    if (!event.target.closest('.account-wrapper')) setAccountOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#account-menu').hidden) { setAccountOpen(false, true); event.preventDefault(); }
  });
  $('#open-key').addEventListener('click', () => setAccountOpen(false));
  const dialogs = document.createElement('div');
  dialogs.innerHTML = `<dialog id="login-dialog" aria-labelledby="login-title"><form id="login-form">
    <div class="dialog-heading"><h2 id="login-title">Sign in to your records</h2><button type="button" class="close-button" id="login-close" aria-label="Close sign in">×</button></div>
    <p class="dialog-intro">Use your dispensing app account. This is separate from the account used to manage the database.</p>
    <label class="field">Email<input id="login-email" type="email" autocomplete="username" required maxlength="254"></label>
    <label class="field">Password<input id="login-password" type="password" autocomplete="current-password" required></label>
    <p id="login-error" class="inline-error" role="status" hidden></p>
    <div class="dialog-actions"><button type="button" id="login-reset" class="link-button">Forgot password?</button><button id="login-submit" class="button primary">Sign in</button></div>
  </form></dialog>
  <dialog id="password-dialog" aria-labelledby="password-title"><form id="password-form"><h2 id="password-title">Choose a new password</h2><p class="dialog-intro">Use at least 12 characters.</p><label class="field">New password<input id="new-password" type="password" autocomplete="new-password" minlength="12" required></label><p id="password-error" class="inline-error" role="alert" hidden></p><div class="dialog-actions"><button class="button primary">Save password</button></div></form></dialog>
  <dialog id="conflict-dialog" aria-labelledby="conflict-title"><div class="dialog-heading"><h2 id="conflict-title">Review changes</h2><button id="conflict-close" class="close-button" aria-label="Close review">×</button></div><p class="dialog-intro">These items changed both here and online. Choose which versions to keep. All other changes will be combined.</p><div id="conflict-items"></div><p id="conflict-error" class="inline-error" role="alert" hidden></p><button id="conflict-backup" class="link-button">Download device backup first</button><div class="dialog-actions"><button id="conflict-local" class="button secondary">Use device versions</button><button id="conflict-remote" class="button primary">Use online versions</button></div></dialog>`;
  document.body.append(dialogs);
  let client, engine, session = null, mode = 'loading', recovery = false, queued = null, passwordResetEnabled = false;
  let canEdit = !read().cloud;
  locked(!canEdit);
  const message = (selector, text) => { $(selector).textContent = text; $(selector).hidden = !text; };
  function render(next, detail = {}) {
    mode = next;
    const state = read();
    const sameAccount = session && (!state.cloud || (state.cloud.owner === session.user.id && state.cloud.project === engine?.project));
    canEdit = !recovery && (!state.cloud || !!sameAccount);
    locked(!canEdit);
    const messages = {
      local: 'Saved on this device only. Online saving has not been connected yet.',
      signedout: state.cloud ? 'Sign in to access your saved records on this device and online.' : 'Sign in to save your records and bonus key online.',
      syncing: 'Syncing records and bonus key…', saved: 'Saved online and on this device.',
      connect: 'Your existing records and bonus key are still on this device. Connect to combine them with your account’s online copy.',
      conflict: 'Changes need review. Your device records are safe; online saving is waiting.',
      waiting: 'Saved on this device. Waiting to sync.',
      mismatch: 'This device is linked to a different account. Sign out and use the original account.',
      error: 'Online saving is unavailable. Your saved device data has been kept.',
    };
    message('#cloud-status', detail.message || messages[next] || 'Checking online settings…');
    message('#cloud-account', session ? `Signed in as ${session.user.email || 'your account'}` : '');
    $('#cloud-login').hidden = !client || !!session;
    $('#cloud-signout').hidden = !session;
    $('#cloud-signout').disabled = next === 'syncing';
    $('#cloud-sync').hidden = !sameAccount || ['connect', 'conflict'].includes(next);
    $('#cloud-sync').disabled = next === 'syncing';
    $('#cloud-connect').hidden = next !== 'connect';
    $('#cloud-review').hidden = next !== 'conflict';
    const brief = next === 'saved' ? 'Saved online' : next === 'syncing' ? 'Syncing' : ['waiting','error','conflict','connect','mismatch'].includes(next) ? 'Needs attention' : session ? 'Signed in' : 'Not signed in';
    $('#account-dot').dataset.status = next;
    $('#account-toggle').setAttribute('aria-label', `Account: ${brief}`);
    $('#account-toggle').title = brief;
    if (['connect', 'mismatch'].includes(next)) setAccountOpen(true);
    if (state.cloud) $('.page-footer p').textContent = 'Records and your bonus key sync to your account. Changes waiting to sync are saved only on this device. Keep regular backups.';
  }
  async function sync(connect = false) {
    if (!session || !engine || recovery) return;
    // Cross-tab locking avoids concurrent updates to the local sync base.
    const run = () => engine.run(session.user.id, { connect });
    if (navigator.locks) await navigator.locks.request('dispensing-record:cloud', { ifAvailable: true }, lock => lock && run());
    else await run();
  }
  function changed() {
    if (!client || !session || !canEdit) return;
    if (!read().cloud) { render('connect'); return; }
    if (mode === 'conflict') { engine.conflict = null; $('#conflict-dialog').close(); }
    render('waiting');
    clearTimeout(queued); queued = setTimeout(() => sync(), 400);
  }
  $('#cloud-login').onclick = () => { setAccountOpen(false); message('#login-error', ''); $('#login-dialog').showModal(); };
  $('#login-close').onclick = () => $('#login-dialog').close();
  $('#login-form').onsubmit = async event => {
    event.preventDefault(); $('#login-submit').disabled = true; message('#login-error', '');
    try {
      const { error } = await client.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
      if (error) throw error;
      $('#login-password').value = ''; $('#login-dialog').close();
    } catch { message('#login-error', 'Could not sign in. Check your email and password, or try again when the connection is available.'); }
    finally { $('#login-submit').disabled = false; }
  };
  $('#login-reset').onclick = async () => {
    if (!passwordResetEnabled) { message('#login-error', 'Ask the person who manages this app to reset your app password. Your records will stay in your account.'); return; }
    if (!$('#login-email').reportValidity()) return;
    $('#login-reset').disabled = true;
    try {
      const { error } = await client.auth.resetPasswordForEmail($('#login-email').value.trim(), { redirectTo: `${location.origin}${location.pathname}` });
      if (error) throw error;
      message('#login-error', 'If this account exists, a password-reset link will arrive by email. Check your spam folder too.');
    } catch { message('#login-error', 'Could not request a reset. Try again later or contact the account owner.'); }
    finally { $('#login-reset').disabled = false; }
  };
  $('#password-dialog').addEventListener('cancel', event => event.preventDefault());
  $('#password-form').onsubmit = async event => {
    event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
    try {
      const { error } = await client.auth.updateUser({ password: $('#new-password').value });
      if (error) throw error;
      $('#new-password').value = ''; recovery = false; $('#password-dialog').close();
      notify('Password updated.'); await sync();
    } catch { message('#password-error', 'Could not update the password. Please request a new reset link or try again.'); }
    finally { button.disabled = false; }
  };
  $('#cloud-connect').onclick = () => sync(true);
  $('#cloud-sync').onclick = () => sync();
  $('#cloud-signout').onclick = async () => {
    if (engine.running) return;
    const state = read();
    if (state.cloud && mode !== 'saved' && !confirm('Some changes may not be saved online yet. They will remain on this device for your next sign-in. Sign out?')) return;
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) notify('Could not sign out. Please try again.');
  };
  function describe(value, isKey) {
    if (!value) return 'Removed';
    if (!isKey) return `${value.date} · ${value.name} · Customer ${value.number}\n${value.types.join(', ')}\n${recordDetails(value,{issues:[]})}`;
    return `${value.currency} · ${value.confirmed ? 'Confirmed' : 'Unconfirmed'}\n${Object.entries(value.rates).map(([label, rate]) => `${label.split(':')[1]}: ${rate.first === null ? '?' : (rate.first / 100).toFixed(2)} / ${rate.second === null ? '?' : (rate.second / 100).toFixed(2)} (${rate.mode || 'unconfirmed'})`).join('\n')}\n${value.source}`;
  }
  $('#cloud-review').onclick = () => {
    const conflict = engine.conflict; if (!conflict) return;
    setAccountOpen(false);
    $('#conflict-items').replaceChildren(); message('#conflict-error', '');
    for (const item of conflict.conflicts) {
      const section = document.createElement('section'); section.className = 'conflict-item';
      const heading = document.createElement('h3'); heading.textContent = item.id === 'bonus-key' ? 'Bonus key' : (item.local || item.remote).name; section.append(heading);
      for (const [side, title] of [['local', 'On this device'], ['remote', 'Online']]) {
        const label = document.createElement('strong'); label.textContent = title;
        const text = document.createElement('p'); text.textContent = describe(item[side], item.id === 'bonus-key'); section.append(label, text);
      }
      $('#conflict-items').append(section);
    }
    $('#conflict-dialog').showModal();
  };
  $('#conflict-close').onclick = () => $('#conflict-dialog').close();
  $('#conflict-backup').onclick = () => backup();
  for (const side of ['local', 'remote']) $(`#conflict-${side}`).onclick = async () => {
    try { engine.resolve(side); $('#conflict-dialog').close(); await sync(true); }
    catch (error) { message('#conflict-error', error.message); }
  };
  async function start() {
    try {
      const config = await loadCloudConfig();
      if (!config) { render(read().cloud ? 'error' : 'local'); return; }
      passwordResetEnabled = config.passwordResetEnabled;
      if (read().cloud) validateLink(read().cloud);
      client = createCloudClient(config);
      engine = new CloudSync({ adapter: cloudAdapter(client), read: () => { assertFresh(); return read(); }, write, status: render, project: config.url,
        active: owner => session?.user.id === owner && !recovery });
      client.auth.onAuthStateChange((event, nextSession) => {
        session = nextSession;
        if (event === 'PASSWORD_RECOVERY') recovery = true;
        // Supabase's auth callback holds an internal lock. Never await an auth
        // or database call inside it; schedule work outside that callback.
        setTimeout(() => {
          if (recovery) { locked(true); $('#password-dialog').showModal(); return; }
          if (!session) { render('signedout'); return; }
          const binding = read().cloud;
          if (binding && (binding.owner !== session.user.id || binding.project !== config.url)) { render('mismatch'); return; }
          if (event !== 'TOKEN_REFRESHED') sync();
        }, 0);
      });
      const { error } = await client.auth.getSession();
      if (error) throw error;
    } catch (error) { render('error', { message: error.message }); }
  }
  // Retry after genuine user/device activity, not artificial keep-alive calls.
  window.addEventListener('online', () => sync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden && mode !== 'conflict') sync(); });
  window.addEventListener('focus', () => { if (mode === 'waiting' || mode === 'saved') sync(); });
  start();
  return { changed, canEdit: () => canEdit, isBusy: () => !!engine?.running };
}
