import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, blankEntry } from '../src/model.js';
import { CloudSync, documentOf, mergeDocuments } from '../src/cloud-model.js';

const entry = (id, name = id) => ({ ...blankEntry(), id, name, number: '001', types: ['SV'] });
const doc = (...entries) => ({ ...initialState(), entries });
const project = 'https://test.supabase.co';
function harness(initial = doc(), online = null) {
  let local = structuredClone(initial), remote = structuredClone(online), mode, details, signedIn = true;
  let writes = 0, beforeWrite, afterWrite;
  const adapter = {
    async load() { return structuredClone(remote); },
    async write(_, payload, version) {
      writes++; if (beforeWrite) await beforeWrite();
      if ((remote?.version || 0) !== version) return null;
      remote = { payload: structuredClone(payload), version: version + 1 };
      if (afterWrite) await afterWrite();
      return structuredClone(remote);
    },
  };
  const engine = new CloudSync({ adapter, project, read: () => local,
    write: next => (local = { ...structuredClone(next), revision: crypto.randomUUID() }),
    status: (next, detail) => { mode = next; details = detail; }, active: () => signedIn });
  return { engine, adapter, run: options => engine.run('owner', options),
    get local() { return local; }, get remote() { return remote; }, get mode() { return mode; }, get details() { return details; }, get writes() { return writes; },
    edit: fn => { fn(local); local.revision = crypto.randomUUID(); },
    changeRemote: fn => { fn(remote.payload); remote.version++; },
    before: fn => { beforeWrite = fn; }, after: fn => { afterWrite = fn; }, signout: () => { signedIn = false; },
  };
}
test('three-way merge combines new records, updates and deletions without resurrection', () => {
  const base = doc(entry('a'), entry('b'));
  const here = doc(entry('b'), entry('c'));
  const there = doc(entry('a'), entry('b', 'Edited online'), entry('d'));
  const merged = mergeDocuments(base, here, there);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.document.entries.map(e => e.id).sort(), ['b', 'c', 'd']);
  assert.equal(merged.document.entries.find(e => e.id === 'b').name, 'Edited online');
});
test('different local record ordering does not cause repeated cloud writes', async () => {
  const h = harness(doc(entry('b'), entry('a'))); await h.run({ connect: true });
  const writes = h.writes; h.edit(s => { s.entries.reverse(); }); await h.run();
  assert.equal(h.writes, writes); assert.equal(h.mode, 'saved');
});
test('simultaneous edit/delete and bonus-key changes are explicit conflicts', () => {
  const base = doc(entry('a')); const here = doc(); const there = doc(entry('a', 'Edited'));
  here.key.currency = 'GBP'; there.key.confirmed = false;
  assert.deepEqual(mergeDocuments(base, here, there).conflicts.map(c => c.id).sort(), ['a', 'bonus-key']);
});
test('first connection waits for upload action, then syncs records and key', async () => {
  const h = harness(doc(entry('a'))); h.edit(s => { s.key.currency = 'GBP'; });
  await h.run(); assert.equal(h.mode, 'connect'); assert.equal(h.remote, null);
  await h.run({ connect: true }); assert.equal(h.mode, 'saved');
  assert.equal(h.remote.payload.key.currency, 'GBP'); assert.equal(h.local.cloud.owner, 'owner');
  assert.equal(documentOf(h.local).cloud, undefined); assert.equal(h.remote.payload.cloud, undefined);
});
test('fresh browser downloads existing cloud data and key without replacing them', async () => {
  const remote = doc(entry('online')); remote.key.currency = 'GBP';
  const h = harness(doc(), { payload: remote, version: 8 }); await h.run();
  assert.equal(h.mode, 'saved'); assert.equal(h.writes, 0);
  assert.equal(h.local.entries[0].id, 'online'); assert.equal(h.local.key.currency, 'GBP');
});
test('offline failure retains records, then retry saves them', async () => {
  const h = harness(doc(entry('a'))); h.before(() => { throw new Error('Offline'); });
  await h.run({ connect: true }); assert.equal(h.mode, 'waiting'); assert.equal(h.local.entries.length, 1);
  h.before(null); await h.run(); assert.equal(h.mode, 'saved'); assert.equal(h.remote.payload.entries.length, 1);
});
test('lost upload response followed by deletion does not resurrect the deleted record', async () => {
  const h = harness(doc(entry('a'))); h.after(() => { throw new Error('Response lost'); });
  await h.run({ connect: true }); assert.equal(h.mode, 'waiting'); assert.equal(h.remote.payload.entries.length, 1);
  h.edit(s => { s.entries = []; }); h.after(null);
  // Reload from persisted state with its pending upload before retrying.
  const resumed = harness(h.local, h.remote); await resumed.run();
  assert.equal(resumed.mode, 'saved'); assert.equal(resumed.local.entries.length, 0); assert.equal(resumed.remote.payload.entries.length, 0);
});
test('edits made while a request is in flight are uploaded before showing saved', async () => {
  const h = harness(doc(entry('a'))); let once = false;
  h.after(() => { if (!once) { once = true; h.edit(s => { s.entries.push(entry('b')); }); } });
  await h.run({ connect: true }); assert.equal(h.mode, 'saved'); assert.equal(h.remote.payload.entries.length, 2);
});
test('compare-and-swap retries a concurrent server update and retains both records', async () => {
  const h = harness(); await h.run(); h.edit(s => { s.entries.push(entry('a')); }); let once = false;
  h.before(() => { if (!once) { once = true; h.changeRemote(s => { s.entries.push(entry('b')); }); } });
  await h.run(); assert.equal(h.mode, 'saved'); assert.equal(h.remote.payload.entries.length, 2);
});
test('conflict resolution preserves unrelated records and selected copy', async () => {
  const h = harness(doc(entry('a'))); await h.run({ connect: true });
  h.edit(s => { s.entries[0].name = 'Device edit'; s.entries.push(entry('b')); });
  h.changeRemote(s => { s.entries[0].name = 'Online edit'; s.entries.push(entry('c')); });
  await h.run(); assert.equal(h.mode, 'conflict');
  h.engine.resolve('remote'); await h.run(); assert.equal(h.mode, 'saved');
  assert.equal(h.local.entries.find(e => e.id === 'a').name, 'Online edit'); assert.equal(h.local.entries.length, 3);
});
test('changed local data invalidates a stale conflict decision', async () => {
  const h = harness(doc(entry('a'))); await h.run({ connect: true });
  h.edit(s => { s.entries[0].name = 'Device'; }); h.changeRemote(s => { s.entries[0].name = 'Online'; }); await h.run();
  h.edit(s => { s.entries.push(entry('b')); }); assert.throws(() => h.engine.resolve('local'), /Records changed/);
});
test('account/project mismatch and missing online copy never upload device records', async () => {
  const h = harness(); await h.run();
  h.edit(s => { s.cloud.owner = 'different-owner'; }); await h.run(); assert.equal(h.mode, 'waiting'); assert.match(h.details.message, /another account/);
  h.edit(s => { s.cloud.owner = 'owner'; s.cloud.project = 'other-project'; }); await h.run(); assert.match(h.details.message, /another account/);
  h.edit(s => { s.cloud.project = project; }); const missing = harness(h.local); await missing.run(); assert.match(missing.details.message, /missing/); assert.equal(missing.writes, 0);
});
test('uncertain write followed by another server edit asks for review', async () => {
  const h = harness(doc(entry('a'))); h.after(() => { throw new Error('Lost response'); }); await h.run({ connect: true });
  h.changeRemote(s => { s.entries[0].name = 'Later online edit'; }); h.edit(s => { s.entries = []; }); h.after(null);
  await h.run(); assert.equal(h.mode, 'conflict'); assert.equal(h.details.conflicts[0].local, undefined);
});
test('signing out while a request finishes does not expose or apply the response', async () => {
  const h = harness(doc(entry('a'))); h.after(() => h.signout()); await h.run({ connect: true });
  assert.notEqual(h.mode, 'saved'); assert.equal(h.local.cloud.syncedAt, '');
});
