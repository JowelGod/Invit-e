import { describe, expect, it, vi } from 'vitest';

import { buildDraftPeople, parsePastedNames, serializeDraftPeople } from './partyDraft';
import type { InviteeRecord } from './types';

vi.stubGlobal('crypto', { randomUUID: () => '90000000-0000-4000-8000-000000000009' });

describe('party draft', () => {
  it('pairs a plus one with its named guest and preserves public keys', () => {
    const invitees: InviteeRecord[] = [
      {
        id: 'maya-id',
        public_key: 'maya-key',
        display_name: 'Maya',
        response: 'pending',
        responded_at: null,
        invitee_type: 'named_guest',
        companion_of_invitee_id: null,
        companion_label: null,
        display_order: 0,
        retired_at: null,
        created_at: '2026-01-01',
      },
      {
        id: 'plus-id',
        public_key: 'plus-key',
        display_name: 'Acompañante de Maya',
        response: 'pending',
        responded_at: null,
        invitee_type: 'plus_one',
        companion_of_invitee_id: 'maya-id',
        companion_label: 'Acompañante de Maya',
        display_order: 1,
        retired_at: null,
        created_at: '2026-01-01',
      },
    ];

    expect(serializeDraftPeople(buildDraftPeople(invitees))).toEqual([
      { key: 'maya-key', display_name: 'Maya', invitee_type: 'named_guest' },
      {
        key: 'plus-key',
        display_name: 'Acompañante de Maya',
        invitee_type: 'plus_one',
        companion_of_key: 'maya-key',
      },
    ]);
  });

  it('parses pasted names without creating empty people', () => {
    expect(parsePastedNames('Maya\n\nIvanna, Mau; Sharon').map((person) => person.name)).toEqual([
      'Maya',
      'Ivanna',
      'Mau',
      'Sharon',
    ]);
  });
});
