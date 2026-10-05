import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepDate, readEntryDate } from '../src/entry-date.js';
import { localDate } from '../src/model.js';

test('day arrows handle month/year boundaries, leap days and supported date limits', () => {
  for (const [date, days, expected] of [
    ['2026-10-31', 1, '2026-11-01'], ['2026-01-01', -1, '2025-12-31'],
    ['2024-03-01', -1, '2024-02-29'], ['2026-03-01', -1, '2026-02-28'],
    ['1900-01-01', -1, '1900-01-01'], ['9999-12-31', 1, '9999-12-31'],
  ]) assert.equal(stepDate(date, days), expected);
  assert.equal(stepDate('', 1), '');
});
test('remembered entry date validates stored dates and tolerates blocked storage', () => {
  assert.equal(readEntryDate({ getItem: () => '2026-09-30' }), '2026-09-30');
  assert.equal(readEntryDate({ getItem: () => 'invalid' }), localDate());
  assert.equal(readEntryDate({ getItem: () => { throw new Error('blocked'); } }), localDate());
});
