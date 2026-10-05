import { initialState, validateState } from './model.js';
export const STORAGE_KEY = 'dispensing-record:v1';
export function loadState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return { state: raw === null ? initialState() : validateState(JSON.parse(raw)), raw };
}
export function saveState(storage, state, expectedRaw) {
  if (storage.getItem(STORAGE_KEY) !== expectedRaw) throw new Error('Records changed in another tab. Download a backup here, then reload before saving.');
  const next = { ...state, revision: crypto.randomUUID() };
  validateState(next);
  const raw = JSON.stringify(next);
  storage.setItem(STORAGE_KEY,raw);
  return { state: next, raw };
}
