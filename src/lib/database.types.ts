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
  public_content: Json;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type GuestPartyRow = {
  id: string;
  event_id: string;
  name: string;
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
  created_at: string;
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
    };
    CompositeTypes: Record<never, never>;
  };
}
