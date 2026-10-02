import type { GuestPartyRecord, InviteeStatus } from './types';

export type PartyFilter = 'all' | InviteeStatus;

export function filterParties(
  parties: GuestPartyRecord[],
  query: string,
  response: PartyFilter,
): GuestPartyRecord[] {
  const normalized = query.trim().toLocaleLowerCase('es-MX');
  return parties.filter((party) => {
    const matchesText =
      !normalized ||
      [
        party.name,
        party.primary_contact_name,
        party.contact_email || '',
        party.contact_phone || '',
        ...party.invitees.map((invitee) => invitee.display_name || invitee.companion_label || ''),
      ].some((value) => value.toLocaleLowerCase('es-MX').includes(normalized));
    const matchesResponse =
      response === 'all' || party.invitees.some((invitee) => invitee.response === response);
    return matchesText && matchesResponse;
  });
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
