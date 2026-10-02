export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EventRow = {
  id: string;
  organization_id: string;
  title: string;
  starts_at: string;
  timezone: string;
  location_name: string | null;
  capacity: number;
  status: 'draft' | 'published' | 'archived';
  template_id: string;
  published_at: string | null;
  archived_at: string | null;
  public_content: Json;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type GuestPartyRow = {
  id: string;
  event_id: string;
  name: string;
  primary_contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  assigned_capacity: number;
  created_at: string;
  updated_at: string;
};

type InviteeRow = {
  id: string;
  event_id: string;
  guest_party_id: string;
  public_key: string;
  display_name: string | null;
  response: 'pending' | 'confirmed' | 'rejected';
  responded_at: string | null;
  invitee_type: 'named_guest' | 'plus_one';
  companion_of_invitee_id: string | null;
  companion_label: string | null;
  display_order: number;
  retired_at: string | null;
  updated_at: string;
  created_at: string;
};

type ScheduleItemRow = {
  id: string;
  event_id: string;
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
  removed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReadOnlyTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      events: ReadOnlyTable<EventRow>;
      guest_parties: ReadOnlyTable<GuestPartyRow>;
      invitees: ReadOnlyTable<InviteeRow>;
      event_schedule_items: ReadOnlyTable<ScheduleItemRow>;
    };
    Views: Record<never, never>;
    Functions: {
      create_event: {
        Args: {
          p_title: string;
          p_starts_at: string;
          p_capacity: number;
          p_location_name?: string | null;
          p_timezone?: string;
        };
        Returns: string;
      };
      create_guest_party: {
        Args: { p_event_id: string; p_name: string; p_invitees: Json };
        Returns: string;
      };
      create_guest_party_v2: {
        Args: {
          p_event_id: string;
          p_name: string;
          p_primary_contact_name: string;
          p_contact_email: string | null;
          p_contact_phone: string | null;
          p_assigned_capacity: number;
          p_invitees?: Json;
        };
        Returns: string;
      };
      update_event_details: {
        Args: {
          p_event_id: string;
          p_title: string;
          p_starts_at: string;
          p_capacity: number;
          p_location_name: string | null;
          p_timezone: string;
        };
        Returns: undefined;
      };
      change_event_status: {
        Args: { p_event_id: string; p_status: 'draft' | 'published' | 'archived' };
        Returns: undefined;
      };
      change_event_template: {
        Args: { p_event_id: string; p_template_id: string };
        Returns: undefined;
      };
      create_schedule_item: {
        Args: {
          p_event_id: string;
          p_title: string;
          p_description: string | null;
          p_starts_at: string;
          p_ends_at: string | null;
          p_venue_name: string | null;
          p_address: string | null;
          p_place_id?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
        };
        Returns: string;
      };
      update_schedule_item: {
        Args: {
          p_item_id: string;
          p_title: string;
          p_description: string | null;
          p_starts_at: string;
          p_ends_at: string | null;
          p_venue_name: string | null;
          p_address: string | null;
          p_place_id?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
        };
        Returns: undefined;
      };
      remove_schedule_item: { Args: { p_item_id: string }; Returns: undefined };
      reorder_schedule_items: {
        Args: { p_event_id: string; p_item_ids: string[] };
        Returns: undefined;
      };
      update_guest_party: {
        Args: {
          p_guest_party_id: string;
          p_name: string;
          p_primary_contact_name: string;
          p_contact_email: string | null;
          p_contact_phone: string | null;
          p_assigned_capacity: number;
        };
        Returns: undefined;
      };
      update_invitee: {
        Args: {
          p_invitee_id: string;
          p_display_name: string | null;
          p_invitee_type: 'named_guest' | 'plus_one';
          p_companion_of_invitee_id?: string | null;
          p_companion_label?: string | null;
        };
        Returns: undefined;
      };
      reorder_invitees: {
        Args: { p_guest_party_id: string; p_invitee_ids: string[] };
        Returns: undefined;
      };
      retire_invitee: { Args: { p_invitee_id: string }; Returns: undefined };
      create_invitation_link: {
        Args: { p_guest_party_id: string };
        Returns: string;
      };
      event_capacity_summary: {
        Args: { p_event_id: string };
        Returns: Json;
      };
      get_public_invitation: {
        Args: { p_token: string };
        Returns: Json;
      };
      respond_to_invitation: {
        Args: { p_token: string; p_responses: Json; p_idempotency_key: string };
        Returns: Json;
      };
    };
    Enums: {
      app_role: 'owner' | 'admin' | 'planner' | 'viewer';
      event_status: 'draft' | 'published' | 'archived';
      invitee_response: 'pending' | 'confirmed' | 'rejected';
      invitee_kind: 'named_guest' | 'plus_one';
    };
    CompositeTypes: Record<never, never>;
  };
}
