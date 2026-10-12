import { describe, expect, it } from 'vitest';

import {
  buildDraftInvitees,
  createDraftExtra,
  createDraftInvitee,
  moveDraftInvitee,
  reorderDraftInvitees,
  serializeDraftInvitees,
  validatePartyDraft,
} from './partyDraft';
import type { InviteeRecord } from './types';

const base = {
  response: 'pending' as const,
  responded_at: null,
  companion_of_invitee_id: null,
  companion_label: null,
  retired_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('borrador de invitación', () => {
  it('convierte +1 anteriores a boletos extra y conserva llaves y contactos', () => {
    const invitees: InviteeRecord[] = [
      {
        ...base,
        id: 'maya-id',
        public_key: 'maya-key',
        display_name: 'Maya',
        invitee_type: 'named_guest',
        display_order: 0,
      },
      {
        ...base,
        id: 'extra-id',
        public_key: 'extra-key',
        display_name: null,
        invitee_type: 'plus_one',
        display_order: 1,
      },
    ];
    const draft = buildDraftInvitees(invitees, [
      { id: 'contact-id', invitee_id: 'maya-id', kind: 'email', value: 'maya@example.test' },
    ]);
    expect(serializeDraftInvitees(draft)).toEqual([
      {
        key: 'maya-key',
        display_name: 'Maya',
        invitee_type: 'named_guest',
        contacts: [{ kind: 'email', value: 'maya@example.test' }],
      },
      {
        key: 'extra-key',
        display_name: null,
        invitee_type: 'unnamed_extra',
        contacts: [],
      },
    ]);
  });

  it('exige un canal válido, admite varios extras y conserva el orden', () => {
    const maya = createDraftInvitee('Maya');
    maya.contacts = [{ id: 'email', kind: 'email', value: 'maya@example.test' }];
    const draft = [maya, createDraftExtra(), createDraftExtra(), createDraftExtra()];
    expect(validatePartyDraft('Amigos', draft)).toBeNull();
    expect(serializeDraftInvitees(draft)).toHaveLength(4);
    expect(moveDraftInvitee(draft, 3, -1)[2].key).toBe(draft[3].key);
    expect(reorderDraftInvitees(draft, 3, 0).map((item) => item.key)).toEqual([
      draft[3].key,
      draft[0].key,
      draft[1].key,
      draft[2].key,
    ]);
    expect(validatePartyDraft('Amigos', [{ ...maya, contacts: [] }])).toMatch(/correo o teléfono/);
  });
});
