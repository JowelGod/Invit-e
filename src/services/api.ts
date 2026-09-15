import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type {
  CapacitySummary,
  EventDetail,
  EventRecord,
  GuestPartyRecord,
  InviteeRecord,
  PublicInvitation,
  RsvpResponse,
} from '../lib/types';

function fail(message: string, error?: { message?: string } | null): never {
  throw new Error(error?.message || message);
}

export async function listEvents(): Promise<EventRecord[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,starts_at,timezone,location_name,capacity,status')
    .order('starts_at', { ascending: true });
  if (error) fail('No se pudieron cargar los eventos.', error);

  const events = (data || []) as EventRecord[];
  return Promise.all(
    events.map(async (event) => {
      const { data: summary, error: summaryError } = await supabase.rpc('event_capacity_summary', {
        p_event_id: event.id,
      });
      if (summaryError) fail('No se pudo calcular la capacidad.', summaryError);
      return { ...event, summary: summary as unknown as CapacitySummary };
    }),
  );
}

export async function createEvent(input: {
  title: string;
  startsAt: string;
  capacity: number;
  locationName: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_event', {
    p_title: input.title,
    p_starts_at: new Date(input.startsAt).toISOString(),
    p_capacity: input.capacity,
    p_location_name: input.locationName || null,
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
  });
  if (error || typeof data !== 'string') fail('No se pudo crear el evento.', error);
  return data;
}

export async function getEventDetail(eventId: string): Promise<EventDetail> {
  const [eventResult, partiesResult, inviteesResult, summaryResult] = await Promise.all([
    supabase
      .from('events')
      .select('id,title,starts_at,timezone,location_name,capacity,status')
      .eq('id', eventId)
      .single(),
    supabase
      .from('guest_parties')
      .select('id,name,created_at')
      .eq('event_id', eventId)
      .order('created_at'),
    supabase
      .from('invitees')
      .select('id,guest_party_id,public_key,display_name,response,created_at')
      .eq('event_id', eventId)
      .order('created_at'),
    supabase.rpc('event_capacity_summary', { p_event_id: eventId }),
  ]);

  if (eventResult.error) fail('No se pudo cargar el evento.', eventResult.error);
  if (partiesResult.error) fail('No se pudieron cargar los grupos.', partiesResult.error);
  if (inviteesResult.error) fail('No se pudieron cargar los lugares.', inviteesResult.error);
  if (summaryResult.error) fail('No se pudo calcular la capacidad.', summaryResult.error);

  const invitees = (inviteesResult.data || []) as (InviteeRecord & {
    guest_party_id: string;
  })[];
  const parties = ((partiesResult.data || []) as Omit<GuestPartyRecord, 'invitees'>[]).map(
    (party) => ({
      ...party,
      invitees: invitees.filter((invitee) => invitee.guest_party_id === party.id),
    }),
  );

  return {
    event: eventResult.data,
    parties,
    summary: summaryResult.data as unknown as CapacitySummary,
  };
}

export async function createGuestParty(input: {
  eventId: string;
  name: string;
  inviteeNames: (string | null)[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_guest_party', {
    p_event_id: input.eventId,
    p_name: input.name,
    p_invitees: input.inviteeNames.map((displayName) => ({ display_name: displayName })),
  });
  if (error || typeof data !== 'string') fail('No se pudo crear el grupo.', error);
  return data;
}

export async function generateInvitationLink(partyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_invitation_link', {
    p_guest_party_id: partyId,
  });
  if (error || typeof data !== 'string') fail('No se pudo generar el enlace.', error);
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${appUrl.replace(/\/$/, '')}/i/${data}`;
}

export async function getPublicInvitation(token: string): Promise<PublicInvitation | null> {
  const { data, error } = await supabase.rpc('get_public_invitation', { p_token: token });
  if (error) fail('No se pudo abrir la invitación.', error);
  return data as PublicInvitation | null;
}

export async function submitRsvp(
  token: string,
  responses: RsvpResponse[],
  idempotencyKey: string,
): Promise<PublicInvitation | null> {
  const { data, error } = await supabase.rpc('respond_to_invitation', {
    p_token: token,
    p_responses: responses.map(({ invitee_key, status }) => ({ invitee_key, status })),
    p_idempotency_key: idempotencyKey,
  });
  if (error) fail('No se pudo guardar la respuesta.', error);
  return data as PublicInvitation | null;
}

export function subscribeToEvent(eventId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`event-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'invitees', filter: `event_id=eq.${eventId}` },
      onChange,
    )
    .subscribe();
}
