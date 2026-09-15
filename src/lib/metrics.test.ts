import { describe, expect, it } from 'vitest';

import { deriveCapacity } from './metrics';

describe('deriveCapacity', () => {
  it('deriva todos los conteos sin estado duplicado', () => {
    expect(deriveCapacity(8, ['pending', 'confirmed', 'rejected', 'rejected'])).toEqual({
      capacity: 8,
      unassigned: 4,
      pending: 1,
      confirmed: 1,
      rejected: 2,
      available_to_reassign: 6,
    });
  });

  it('mantiene el historial rechazado aunque se hayan emitido más filas que la capacidad', () => {
    expect(deriveCapacity(2, ['rejected', 'rejected', 'confirmed', 'pending'])).toMatchObject({
      unassigned: 0,
      confirmed: 1,
      pending: 1,
      rejected: 2,
      available_to_reassign: 0,
    });
  });
});
