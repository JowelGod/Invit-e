import type { DeliveryRecipient, InviteeRecord } from './types';

export interface DraftPerson {
  key: string;
  name: string;
  plusOne: { key: string; name: string } | null;
}

export function createDraftPerson(name = ''): DraftPerson {
  return { key: crypto.randomUUID(), name, plusOne: null };
}

export function buildDraftPeople(invitees: InviteeRecord[]): DraftPerson[] {
  const named = invitees.filter((invitee) => invitee.invitee_type === 'named_guest');
  return named.map((invitee) => {
    const companion = invitees.find(
      (candidate) =>
        candidate.invitee_type === 'plus_one' &&
        candidate.companion_of_invitee_id === invitee.id,
    );
    return {
      key: invitee.public_key,
      name: invitee.display_name || '',
      plusOne: companion
        ? {
            key: companion.public_key,
            name: companion.display_name || companion.companion_label || 'Acompañante',
          }
        : null,
    };
  });
}

export function serializeDraftPeople(people: DraftPerson[]) {
  return people.flatMap((person) => [
    {
      key: person.key,
      display_name: person.name.trim(),
      invitee_type: 'named_guest' as const,
    },
    ...(person.plusOne
      ? [
          {
            key: person.plusOne.key,
            display_name:
              person.plusOne.name.trim() || ('Acompañante de ' + person.name.trim()),
            invitee_type: 'plus_one' as const,
            companion_of_key: person.key,
          },
        ]
      : []),
  ]);
}

export function parsePastedNames(value: string): DraftPerson[] {
  return value
    .split(/[\n,;]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => createDraftPerson(name));
}

export function newRecipient(kind: DeliveryRecipient['kind'] = 'email'): DeliveryRecipient {
  return { id: crypto.randomUUID(), kind, value: '' };
}
