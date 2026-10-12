import { describe, expect, it } from 'vitest';

import { combineDisplayDateTime, parseDisplayDate } from './dates';

describe('fecha dd/mm/aaaa', () => {
  it('acepta una fecha válida sin desplazar el día por UTC', () => {
    expect(combineDisplayDateTime('31/12/2027', '23:45')).toBe('2027-12-31T23:45');
  });

  it('rechaza fechas inexistentes y formatos ambiguos', () => {
    expect(parseDisplayDate('31/02/2027')).toBeNull();
    expect(parseDisplayDate('12/31/2027')).toBeNull();
  });
});
