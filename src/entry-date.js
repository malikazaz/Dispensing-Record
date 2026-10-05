import { localDate, validDate } from './model.js';

export const ENTRY_DATE_KEY = 'dispensing-record:entry-date';
export function readEntryDate(storage) {
  try {
    const value = storage.getItem(ENTRY_DATE_KEY);
    if (validDate(value)) return value;
  } catch { /* Date convenience must not block recording. */ }
  return localDate();
}
export function stepDate(value, days) {
  if (!validDate(value) || ![-1, 1].includes(days)) return value;
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const next = date.toISOString().slice(0, 10);
  return validDate(next) ? next : value;
}
