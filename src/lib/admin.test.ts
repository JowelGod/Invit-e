import { describe, expect, it } from 'vitest';

import { filterParties, moveItem } from './admin';
import type { GuestPartyRecord } from './types';

const parties: GuestPartyRecord[] = [
  {
    id: 'party-a',
    name: 'Familia García',
    primary_contact_name: 'Ana García',
    contact_email: 'ana@example.test',
    contact_phone: null,
    assigned_capacity: 2,
    created_at: '2026-01-01T00:00:00Z',
    invitees: [
      {
        id: 'invitee-a',
        public_key: 'key-a',
        display_name: 'Luis García',
        response: 'confirmed',
        responded_at: '2026-01-02T00:00:00Z',
        invitee_type: 'named_guest',
        companion_of_invitee_id: null,
        companion_label: null,
        display_order: 0,
        retired_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  },
];

describe('administración de grupos', () => {
  it('busca por grupo, contacto o invitado y filtra por respuesta', () => {
    expect(filterParties(parties, 'ana@', 'all')).toHaveLength(1);
    expect(filterParties(parties, 'luis', 'confirmed')).toHaveLength(1);
    expect(filterParties(parties, 'garcía', 'rejected')).toHaveLength(0);
  });

  it('reordena sin mutar la colección original', () => {
    const original = ['a', 'b', 'c'];
    expect(moveItem(original, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(original).toEqual(['a', 'b', 'c']);
  });
});
