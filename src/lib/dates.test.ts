import { describe, expect, it } from 'vitest';

import { combineDisplayDateTime, formatDateInput, parseDisplayDate } from './dates';

describe('fecha dd/mm/aaaa', () => {
  it('acepta una fecha válida sin desplazar el día por UTC', () => {
    expect(combineDisplayDateTime('31/12/2027', '23:45')).toBe('2027-12-31T23:45');
  });

  it('rechaza fechas inexistentes y formatos ambiguos', () => {
    expect(parseDisplayDate('31/02/2027')).toBeNull();
    expect(parseDisplayDate('12/31/2027')).toBeNull();
  });

  it('formatea escritura y pegado de números sin cambiar el día ni la hora', () => {
    expect(formatDateInput('1')).toBe('1');
    expect(formatDateInput('1206')).toBe('12/06');
    expect(formatDateInput('12/06/2027')).toBe('12/06/2027');
    expect(formatDateInput('12062027')).toBe('12/06/2027');
    expect(combineDisplayDateTime('12/06/2027', '19:30')).toBe('2027-06-12T19:30');
    expect(combineDisplayDateTime('31/02/2027', '19:30')).toBe('');
    expect(combineDisplayDateTime('12/06/2027', '25:00')).toBe('');
  });
});
