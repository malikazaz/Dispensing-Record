import { initialState, validateState } from './model.js';

// Sync bookkeeping never goes into exports, backups or the remote document.
export function documentOf(state) {
  return structuredClone({ version: 1, revision: '', entries: [...state.entries].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), key: state.key });
}
const canonical = value => JSON.stringify(value, function (_, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
export const equal = (a, b) => canonical(a) === canonical(b);
export const hasLocalData = state => !equal(documentOf(state), documentOf(initialState()));
export function validateLink(link) {
  if (!link || typeof link.owner !== 'string' || typeof link.project !== 'string' ||
      !Number.isSafeInteger(link.version) || link.version < 0 || typeof link.syncedAt !== 'string') {
    throw new Error('Online-save settings could not be read. Download a backup before restoring your records.');
  }
  validateState(link.base);
  if (link.flight) {
    validateState(link.flight.document); validateState(link.flight.remote);
    if (!Number.isSafeInteger(link.flight.expectedVersion) || link.flight.expectedVersion < 0) throw new Error('Invalid pending upload. Download a backup before restoring.');
  }
  return link;
}

// A missing record is a deletion. Compare each side against the last shared copy,
// so offline edits cannot resurrect a record removed on a different device.
export function mergeDocuments(base, local, remote, choices = {}) {
  for (const state of [base, local, remote]) validateState(state);
  const conflicts = [];
  const choose = (id, before, here, there) => {
    if (equal(here, there) || equal(there, before)) return here;
    if (equal(here, before)) return there;
    if (choices[id] === 'local') return here;
    if (choices[id] === 'remote') return there;
    conflicts.push({ id, local: here, remote: there });
    return here;
  };
  const [b, l, r] = [base, local, remote].map(s => new Map(s.entries.map(e => [e.id, e])));
  const ids = new Set([...l.keys(), ...r.keys(), ...b.keys()]);
  const entries = [...ids].map(id => choose(id, b.get(id), l.get(id), r.get(id))).filter(Boolean);
  const key = choose('bonus-key', base.key, local.key, remote.key);
  const document = documentOf({ entries, key });
  validateState(document);
  return { document: structuredClone(document), conflicts };
}

export class CloudSync {
  constructor({ adapter, read, write, status, active, project }) {
    Object.assign(this, { adapter, read, write, status, active, project });
    this.running = false;
    this.conflict = null;
  }
  async run(owner, { connect = false } = {}) {
    if (this.running) return;
    this.running = true;
    try {
      this.status('syncing');
      // Repeat when a local edit arrives during a network request. A bounded
      // loop yields to the UI; periodic retries complete any remaining work.
      for (let attempt = 0; attempt < 5; attempt++) {
        if (!this.active(owner)) return;
        let local = this.read();
        const link = local.cloud && validateLink(local.cloud);
        if (link && (link.owner !== owner || link.project !== this.project)) {
          throw new Error('These device records belong to another account or project. Sign in to the original account.');
        }
        if (!link && !connect && hasLocalData(local)) { this.status('connect'); return; }
        const remoteRow = await this.adapter.load(owner);
        if (!this.active(owner)) return;
        local = this.read();
        let base = local.cloud?.base || initialState();
        // A previously synced document must not disappear silently.
        if (!remoteRow && local.cloud?.version > 0) throw new Error('The online copy is missing. Your device records are safe; ask the account owner to check the database.');
        const remote = remoteRow ? validateState(remoteRow.payload) : initialState();
        const flight = local.cloud?.flight;
        if (flight) {
          if ((remoteRow?.version || 0) > flight.expectedVersion && equal(documentOf(remote), flight.document)) {
            // The server saved our last upload but its response was lost.
            // Edits/deletions made since sending are relative to that upload.
            base = flight.document;
          } else if ((remoteRow?.version || 0) !== flight.expectedVersion || !equal(documentOf(remote), flight.remote)) {
            // The server changed after an uncertain upload. We cannot know
            // which write won; ask rather than infer a deletion or overwrite.
            const localMap = new Map(local.entries.map(e => [e.id, e]));
            const remoteMap = new Map(remote.entries.map(e => [e.id, e]));
            const conflicts = [...new Set([...localMap.keys(), ...remoteMap.keys()])]
              .filter(id => !equal(localMap.get(id), remoteMap.get(id)))
              .map(id => ({ id, local: localMap.get(id), remote: remoteMap.get(id) }));
            if (!equal(local.key, remote.key)) conflicts.push({ id: 'bonus-key', local: local.key, remote: remote.key });
            if (conflicts.length) {
              this.conflict = { owner, localRevision: local.revision, remote, remoteVersion: remoteRow?.version || 0, document: documentOf(local), conflicts };
              this.status('conflict', this.conflict); return;
            }
          }
        }
        const merged = mergeDocuments(base, documentOf(local), remote);
        if (merged.conflicts.length) {
          this.conflict = { owner, localRevision: local.revision, remote, remoteVersion: remoteRow?.version || 0, ...merged };
          this.status('conflict', this.conflict);
          return;
        }
        // Bind before uploading. A lost response can then be reconciled safely
        // on reload without treating the device as a fresh import.
        if (!local.cloud) {
          local = this.write({ ...local, cloud: { owner, project: this.project, base: documentOf(initialState()), version: 0, syncedAt: '' } });
        }
        const snapshot = documentOf(local);
        let saved = remoteRow;
        if (!saved || !equal(documentOf(remote), merged.document)) {
          // Keep upload intent in the same atomic localStorage write as the
          // records, so a lost response cannot resurrect later deletions.
          local = this.write({ ...local, cloud: { ...local.cloud, flight: {
            document: merged.document, remote: documentOf(remote), expectedVersion: remoteRow?.version || 0,
          } } });
          saved = await this.adapter.write(owner, merged.document, remoteRow?.version || 0);
          if (!saved) {
            const latest = this.read();
            const { flight: _, ...withoutFlight } = latest.cloud;
            this.write({ ...latest, cloud: withoutFlight });
            continue; // Another device won the compare-and-swap.
          }
        }
        if (!this.active(owner)) return;
        const current = this.read();
        const after = mergeDocuments(snapshot, documentOf(current), saved.payload);
        const cloud = { owner, project: this.project, version: saved.version, base: documentOf(saved.payload), syncedAt: new Date().toISOString() };
        if (after.conflicts.length) {
          // Keep the old base so the next pass presents the same conflict.
          this.conflict = { owner, localRevision: current.revision, remote: saved.payload, remoteVersion: saved.version, ...after };
          this.status('conflict', this.conflict); return;
        }
        this.write({ ...current, ...after.document, cloud });
        if (equal(after.document, documentOf(saved.payload))) {
          this.conflict = null; this.status('saved', { syncedAt: cloud.syncedAt }); return;
        }
      }
      this.status('waiting', { message: 'Saved on this device. Waiting to finish syncing; try Sync now.' });
    } catch (error) {
      if (this.active(owner)) this.status('waiting', { message: error.message || 'Online saving is unavailable. Your records remain on this device.' });
    } finally { this.running = false; }
  }
  resolve(side) {
    const conflict = this.conflict;
    if (!conflict || this.running || !this.active(conflict.owner)) return;
    const current = this.read();
    if (current.revision !== conflict.localRevision) throw new Error('Records changed while you were reviewing. Sync again before choosing a copy.');
    // Non-conflicting changes remain combined. Only the listed conflicts use
    // the selected side, and a subsequent server change still goes through CAS.
    const document = structuredClone(conflict.document);
    for (const item of conflict.conflicts) {
      const selected = side === 'local' ? item.local : item.remote;
      if (item.id === 'bonus-key') document.key = selected;
      else {
        document.entries = document.entries.filter(e => e.id !== item.id);
        if (selected) document.entries.push(selected);
      }
    }
    this.write({ ...current, ...document, cloud: {
      owner: conflict.owner, project: this.project, base: documentOf(conflict.remote),
      version: conflict.remoteVersion, syncedAt: current.cloud?.syncedAt || '',
    } });
    this.conflict = null;
  }
}
