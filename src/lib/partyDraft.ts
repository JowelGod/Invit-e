import type { DeliveryRecipient, InviteeRecord } from './types';

export type DraftContactKind = 'email' | 'phone';

export interface DraftContact {
  id: string;
  kind: DraftContactKind;
  value: string;
}

export interface DraftInvitee {
  key: string;
  type: 'named_guest' | 'unnamed_extra';
  name: string;
  contacts: DraftContact[];
}

export function createDraftInvitee(name = ''): DraftInvitee {
  return { key: crypto.randomUUID(), type: 'named_guest', name, contacts: [] };
}

export function createDraftExtra(): DraftInvitee {
  return { key: crypto.randomUUID(), type: 'unnamed_extra', name: '', contacts: [] };
}

export function createDraftContact(kind: DraftContactKind): DraftContact {
  return { id: crypto.randomUUID(), kind, value: '' };
}

export function buildDraftInvitees(
  invitees: InviteeRecord[],
  recipients: DeliveryRecipient[],
): DraftInvitee[] {
  const firstNamedId = invitees.find((invitee) => invitee.invitee_type === 'named_guest')?.id;
  return invitees.map((invitee) => ({
    key: invitee.public_key,
    type: invitee.invitee_type === 'named_guest' ? 'named_guest' : 'unnamed_extra',
    name: invitee.invitee_type === 'named_guest' ? invitee.display_name || '' : '',
    contacts:
      invitee.invitee_type === 'named_guest'
        ? recipients
            .filter(
              (recipient) =>
                recipient.invitee_id === invitee.id ||
                (!recipient.invitee_id && invitee.id === firstNamedId),
            )
            .map((recipient) => ({
              id: recipient.id,
              kind: recipient.kind,
              value: recipient.value,
            }))
        : [],
  }));
}

export function serializeDraftInvitees(invitees: DraftInvitee[]) {
  return invitees.map((invitee) => ({
    key: invitee.key,
    display_name: invitee.type === 'named_guest' ? invitee.name.trim() : null,
    invitee_type: invitee.type,
    contacts:
      invitee.type === 'named_guest'
        ? invitee.contacts
            .map(({ kind, value }) => ({ kind, value: value.trim() }))
            .filter((contact) => contact.value)
        : [],
  }));
}

export function parsePastedNames(value: string): DraftInvitee[] {
  return value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => createDraftInvitee(name));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function validatePartyDraft(title: string, invitees: DraftInvitee[]): string | null {
  if (!title.trim()) return 'Escribe el título de la invitación.';
  if (!invitees.some((invitee) => invitee.type === 'named_guest')) {
    return 'Agrega al menos un invitado nominal.';
  }
  if (invitees.some((invitee) => invitee.type === 'named_guest' && !invitee.name.trim())) {
    return 'Todos los invitados nominales necesitan nombre.';
  }
  if (
    invitees.some(
      (invitee) => invitee.contacts.filter((contact) => contact.kind === 'phone').length > 2,
    )
  ) {
    return 'Cada invitado admite como máximo dos teléfonos.';
  }
  const contacts = invitees
    .filter((invitee) => invitee.type === 'named_guest')
    .flatMap((invitee) => invitee.contacts)
    .filter((contact) => contact.value.trim());
  if (
    contacts.some((contact) =>
      contact.kind === 'email' ? !isValidEmail(contact.value) : !isValidPhone(contact.value),
    )
  ) {
    return 'Corrige los correos o teléfonos antes de guardar.';
  }
  if (contacts.length === 0) return 'Agrega al menos un correo o teléfono válido.';
  return null;
}

export function moveDraftInvitee(
  invitees: DraftInvitee[],
  index: number,
  direction: -1 | 1,
): DraftInvitee[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= invitees.length) return invitees;
  const next = [...invitees];
  const [invitee] = next.splice(index, 1);
  next.splice(nextIndex, 0, invitee);
  return next;
}

export function reorderDraftInvitees(
  invitees: DraftInvitee[],
  fromIndex: number,
  toIndex: number,
): DraftInvitee[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= invitees.length ||
    toIndex >= invitees.length
  )
    return invitees;
  const next = [...invitees];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
