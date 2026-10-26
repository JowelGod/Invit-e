import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Json } from '../lib/database.types';
import type {
  CapacitySummary,
  DeliveryRecipient,
  EventDetail,
  EventRecord,
  GuestPartyRecord,
  InviteeKind,
  InviteeRecord,
  PublicInvitation,
  RsvpResponse,
  TrashedEvent,
} from '../lib/types';

function fail(message: string, error?: { message?: string } | null): never {
  throw new Error(error?.message || message);
}

export async function listEvents(): Promise<EventRecord[]> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id,title,starts_at,timezone,location_name,capacity,status,template_id,published_at,archived_at,deleted_at',
    )
    .is('deleted_at', null)
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
  activityTitle: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  venueName: string;
  address: string;
  description: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_event_with_activity', {
    p_title: input.title,
    p_activity_title: input.activityTitle,
    p_starts_at: new Date(input.startsAt).toISOString(),
    p_ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    p_capacity: input.capacity,
    p_venue_name: input.venueName || null,
    p_address: input.address || null,
    p_description: input.description || null,
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
  });
  if (error || typeof data !== 'string') fail('No se pudo crear el evento.', error);
  return data;
}

export async function getEventDetail(eventId: string): Promise<EventDetail> {
  const [
    eventResult,
    partiesResult,
    inviteesResult,
    scheduleResult,
    summaryResult,
    deliveryResult,
  ] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id,title,starts_at,timezone,location_name,capacity,status,template_id,published_at,archived_at,deleted_at',
      )
      .eq('id', eventId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('guest_parties')
      .select(
        'id,name,primary_contact_name,contact_email,contact_phone,assigned_capacity,created_at',
      )
      .eq('event_id', eventId)
      .order('created_at'),
    supabase
      .from('invitees')
      .select(
        'id,guest_party_id,public_key,display_name,response,responded_at,invitee_type,companion_of_invitee_id,companion_label,display_order,retired_at,created_at',
      )
      .eq('event_id', eventId)
      .is('retired_at', null)
      .order('display_order'),
    supabase
      .from('event_schedule_items')
      .select(
        'id,title,description,starts_at,ends_at,venue_name,address,place_id,latitude,longitude,display_order',
      )
      .eq('event_id', eventId)
      .is('removed_at', null)
      .order('starts_at'),
    supabase.rpc('event_capacity_summary', { p_event_id: eventId }),
    supabase.rpc('get_event_delivery_state', { p_event_id: eventId }),
  ]);

  if (eventResult.error) fail('No se pudo cargar el evento.', eventResult.error);
  if (partiesResult.error) fail('No se pudieron cargar los grupos.', partiesResult.error);
  if (inviteesResult.error) fail('No se pudieron cargar los lugares.', inviteesResult.error);
  if (scheduleResult.error) fail('No se pudo cargar la agenda.', scheduleResult.error);
  if (summaryResult.error) fail('No se pudo calcular la capacidad.', summaryResult.error);
  if (deliveryResult.error) fail('No se pudieron cargar los destinatarios.', deliveryResult.error);

  const invitees = (inviteesResult.data || []) as (InviteeRecord & {
    guest_party_id: string;
  })[];
  const delivery = (deliveryResult.data || []) as unknown as Array<{
    party_id: string;
    has_active_link: boolean;
    recipients: DeliveryRecipient[];
  }>;
  const parties = (
    (partiesResult.data || []) as Omit<
      GuestPartyRecord,
      'invitees' | 'recipients' | 'has_active_link'
    >[]
  ).map((party) => {
    const state = delivery.find((item) => item.party_id === party.id);
    return {
      ...party,
      invitees: invitees.filter((invitee) => invitee.guest_party_id === party.id),
      recipients: state?.recipients || [],
      has_active_link: state?.has_active_link || false,
    };
  });

  return {
    event: eventResult.data,
    parties,
    schedule: scheduleResult.data || [],
    summary: summaryResult.data as unknown as CapacitySummary,
  };
}

export async function createGuestParty(input: {
  eventId: string;
  name: string;
  primaryContactName: string;
  contactEmail: string;
  contactPhone: string;
  assignedCapacity: number;
  inviteeNames: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_guest_party_v2', {
    p_event_id: input.eventId,
    p_name: input.name,
    p_primary_contact_name: input.primaryContactName,
    p_contact_email: input.contactEmail || null,
    p_contact_phone: input.contactPhone || null,
    p_assigned_capacity: input.assignedCapacity,
    p_invitees: input.inviteeNames.map((displayName) => ({
      client_key: crypto.randomUUID(),
      display_name: displayName,
      invitee_type: 'named_guest',
    })),
  });
  if (error || typeof data !== 'string') fail('No se pudo crear el grupo.', error);
  return data;
}

export interface SaveGuestPartyInput {
  eventId: string;
  partyId: string | null;
  name: string;
  invitees: Array<{
    key: string;
    display_name: string | null;
    invitee_type: 'named_guest' | 'unnamed_extra';
    contacts: Array<{ kind: 'email' | 'phone'; value: string }>;
  }>;
}

export async function saveGuestParty(
  input: SaveGuestPartyInput,
): Promise<{ partyId: string; link: string | null }> {
  const { data, error } = await supabase.rpc('save_guest_party_v4', {
    p_event_id: input.eventId,
    p_guest_party_id: input.partyId,
    p_name: input.name,
    p_invitees: input.invitees as unknown as Json,
  });
  if (error || !data || typeof data !== 'object') fail('No se pudo guardar el grupo.', error);
  const result = data as { party_id?: string; token?: string | null };
  if (!result.party_id) fail('La base no confirmó el grupo.');
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  return {
    partyId: result.party_id,
    link: result.token ? appUrl.replace(/\/$/, '') + '/i/' + result.token : null,
  };
}

export async function resetGuestPartyResponses(partyId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_guest_party_responses', {
    p_guest_party_id: partyId,
  });
  if (error) fail('No se pudieron reiniciar las respuestas.', error);
}

export async function deleteDraftEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_draft_event', { p_event_id: eventId });
  if (error) fail('No se pudo eliminar el evento.', error);
}

export async function moveEventToTrash(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('move_event_to_trash', { p_event_id: eventId });
  if (error) fail('No se pudo mover el evento a la papelera.', error);
}

export async function listTrashedEvents(): Promise<TrashedEvent[]> {
  const { data, error } = await supabase.rpc('get_trashed_events');
  if (error) fail('No se pudo cargar la papelera.', error);
  return (data || []) as unknown as TrashedEvent[];
}

export async function restoreTrashedEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_trashed_event', { p_event_id: eventId });
  if (error) fail('No se pudo restaurar el evento.', error);
}

export async function purgeTrashedEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('purge_trashed_event', { p_event_id: eventId });
  if (error) fail('No se pudo eliminar definitivamente el evento.', error);
}

export async function updateEvent(input: {
  eventId: string;
  title: string;
  startsAt: string;
  capacity: number;
  locationName: string;
  timezone: string;
}): Promise<void> {
  const { error } = await supabase.rpc('update_event_details', {
    p_event_id: input.eventId,
    p_title: input.title,
    p_starts_at: new Date(input.startsAt).toISOString(),
    p_capacity: input.capacity,
    p_location_name: input.locationName || null,
    p_timezone: input.timezone,
  });
  if (error) fail('No se pudo actualizar el evento.', error);
}

export async function changeEventStatus(
  eventId: string,
  status: 'draft' | 'published' | 'archived',
): Promise<void> {
  const { error } = await supabase.rpc('change_event_status', {
    p_event_id: eventId,
    p_status: status,
  });
  if (error) fail('No se pudo cambiar el estado.', error);
}

export interface ScheduleInput {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  address: string;
}

export async function createScheduleItem(eventId: string, input: ScheduleInput): Promise<void> {
  const { error } = await supabase.rpc('create_schedule_item', {
    p_event_id: eventId,
    p_title: input.title,
    p_description: input.description || null,
    p_starts_at: new Date(input.startsAt).toISOString(),
    p_ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    p_venue_name: input.venueName || null,
    p_address: input.address || null,
  });
  if (error) fail('No se pudo agregar la actividad.', error);
}

export async function updateScheduleItem(itemId: string, input: ScheduleInput): Promise<void> {
  const { error } = await supabase.rpc('update_schedule_item', {
    p_item_id: itemId,
    p_title: input.title,
    p_description: input.description || null,
    p_starts_at: new Date(input.startsAt).toISOString(),
    p_ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    p_venue_name: input.venueName || null,
    p_address: input.address || null,
  });
  if (error) fail('No se pudo actualizar la actividad.', error);
}

export async function removeScheduleItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_schedule_item', { p_item_id: itemId });
  if (error) fail('No se pudo retirar la actividad.', error);
}

export async function reorderSchedule(eventId: string, itemIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_schedule_items', {
    p_event_id: eventId,
    p_item_ids: itemIds,
  });
  if (error) fail('No se pudo reordenar la agenda.', error);
}

export async function updateGuestParty(input: {
  partyId: string;
  name: string;
  primaryContactName: string;
  contactEmail: string;
  contactPhone: string;
  assignedCapacity: number;
}): Promise<void> {
  const { error } = await supabase.rpc('update_guest_party', {
    p_guest_party_id: input.partyId,
    p_name: input.name,
    p_primary_contact_name: input.primaryContactName,
    p_contact_email: input.contactEmail || null,
    p_contact_phone: input.contactPhone || null,
    p_assigned_capacity: input.assignedCapacity,
  });
  if (error) fail('No se pudo actualizar el grupo.', error);
}

export async function updateInvitee(input: {
  inviteeId: string;
  displayName: string;
  kind: InviteeKind;
  companionOfId?: string | null;
  companionLabel?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('update_invitee', {
    p_invitee_id: input.inviteeId,
    p_display_name: input.displayName || null,
    p_invitee_type: input.kind,
    p_companion_of_invitee_id: input.companionOfId || null,
    p_companion_label: input.companionLabel || null,
  });
  if (error) fail('No se pudo actualizar el lugar.', error);
}

export async function reorderInvitees(partyId: string, inviteeIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_invitees', {
    p_guest_party_id: partyId,
    p_invitee_ids: inviteeIds,
  });
  if (error) fail('No se pudieron reordenar los lugares.', error);
}

export async function retireInvitee(inviteeId: string): Promise<void> {
  const { error } = await supabase.rpc('retire_invitee', { p_invitee_id: inviteeId });
  if (error) fail('No se pudo retirar el lugar.', error);
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
