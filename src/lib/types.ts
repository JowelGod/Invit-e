export type AppRole = 'owner' | 'admin' | 'planner' | 'viewer';
export type InviteeStatus = 'pending' | 'confirmed' | 'rejected';
export type InviteeKind = 'named_guest' | 'plus_one';
export type EventStatus = 'draft' | 'published' | 'archived';

export interface CapacitySummary {
  capacity: number;
  assigned: number;
  unassigned: number;
  pending: number;
  confirmed: number;
  rejected: number;
  available_to_reassign: number;
  response_percentage: number;
}

export interface EventRecord {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  location_name: string | null;
  capacity: number;
  status: EventStatus;
  template_id: string;
  published_at: string | null;
  archived_at: string | null;
  summary?: CapacitySummary;
}

export interface InviteeRecord {
  id: string;
  public_key: string;
  display_name: string | null;
  response: InviteeStatus;
  responded_at: string | null;
  invitee_type: InviteeKind;
  companion_of_invitee_id: string | null;
  companion_label: string | null;
  display_order: number;
  retired_at: string | null;
  created_at: string;
}

export interface GuestPartyRecord {
  id: string;
  name: string;
  primary_contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  assigned_capacity: number;
  created_at: string;
  invitees: InviteeRecord[];
}

export interface ScheduleItem {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  address: string | null;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  display_order: number;
}

export interface EventDetail {
  event: EventRecord;
  parties: GuestPartyRecord[];
  schedule: ScheduleItem[];
  summary: CapacitySummary;
}

export interface PublicPlace {
  key: string;
  name: string | null;
  status: InviteeStatus;
  type: InviteeKind;
  companion_label: string | null;
  companion_of_key: string | null;
}

export type PublicScheduleItem = Omit<ScheduleItem, 'id' | 'display_order'>;

export interface PublicInvitation {
  event: {
    title: string;
    starts_at: string;
    timezone: string;
    location_name: string | null;
    content: Record<string, unknown>;
    template_id: string;
    schedule: PublicScheduleItem[];
  };
  party: { name: string };
  places: PublicPlace[];
}

export interface RsvpResponse {
  invitee_key: string;
  status: Exclude<InviteeStatus, 'pending'>;
}
