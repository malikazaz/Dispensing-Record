import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/model.js';
import { STORAGE_KEY,loadState,saveState } from '../src/storage.js';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};
test('save and reload preserves all state and assigns a revision',()=>{
  const storage=memory(),first=loadState(storage);assert.equal(first.raw,null);
  const saved=saveState(storage,first.state,null);assert.ok(saved.state.revision);assert.deepEqual(loadState(storage),saved);
});
test('stale tabs cannot silently overwrite newer data',()=>{
  const storage=memory();saveState(storage,initialState(),null);
  const before=storage.getItem(STORAGE_KEY);assert.throws(()=>saveState(storage,initialState(),null),/another tab/);assert.equal(storage.getItem(STORAGE_KEY),before);
});
test('corrupt data is left untouched',()=>{
  const storage=memory();storage.setItem(STORAGE_KEY,'broken');assert.throws(()=>loadState(storage));assert.equal(storage.getItem(STORAGE_KEY),'broken');
});
test('storage quota failures do not change in-memory state',()=>{
  const state=initialState(),before=structuredClone(state),storage={getItem:()=>null,setItem:()=>{throw new Error('Quota exceeded')}};
  assert.throws(()=>saveState(storage,state,null),/Quota/);assert.deepEqual(state,before);
});
