export type AppRole = 'owner' | 'admin' | 'planner' | 'viewer';
export type InviteeStatus = 'pending' | 'confirmed' | 'rejected';

export interface CapacitySummary {
  capacity: number;
  unassigned: number;
  pending: number;
  confirmed: number;
  rejected: number;
  available_to_reassign: number;
}

export interface EventRecord {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  location_name: string | null;
  capacity: number;
  status: 'draft' | 'published' | 'archived';
  summary?: CapacitySummary;
}

export interface InviteeRecord {
  id: string;
  public_key: string;
  display_name: string | null;
  response: InviteeStatus;
  created_at: string;
}

export interface GuestPartyRecord {
  id: string;
  name: string;
  created_at: string;
  invitees: InviteeRecord[];
}

export interface EventDetail {
  event: EventRecord;
  parties: GuestPartyRecord[];
  summary: CapacitySummary;
}

export interface PublicPlace {
  key: string;
  name: string | null;
  status: InviteeStatus;
}

export interface PublicInvitation {
  event: {
    title: string;
    starts_at: string;
    timezone: string;
    location_name: string | null;
    content: Record<string, unknown>;
  };
  party: { name: string };
  places: PublicPlace[];
}

export interface RsvpResponse {
  invitee_key: string;
  status: Exclude<InviteeStatus, 'pending'>;
}
