create type public.invitee_kind as enum ('named_guest', 'plus_one');

alter table public.events
  add column template_id text,
  add column published_at timestamptz,
  add column archived_at timestamptz;

update public.events
set
  template_id = 'basic',
  published_at = case
    when status in ('published', 'archived') then updated_at
    else published_at
  end,
  archived_at = case
    when status = 'archived' then updated_at
    else archived_at
  end;

alter table public.events
  alter column template_id set default 'basic',
  alter column template_id set not null,
  add constraint events_template_id_format
    check (template_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  add constraint events_lifecycle_timestamps
    check (
      (status = 'draft' and published_at is null and archived_at is null)
      or (status = 'published' and published_at is not null and archived_at is null)
      or (status = 'archived' and archived_at is not null)
    );

alter table public.guest_parties
  add column primary_contact_name text,
  add column contact_email text,
  add column contact_phone text,
  add column assigned_capacity integer;

update public.guest_parties party
set
  primary_contact_name = party.name,
  assigned_capacity = greatest(
    (select count(*)::integer from public.invitees invitee where invitee.guest_party_id = party.id),
    1
  );

alter table public.guest_parties
  alter column primary_contact_name set not null,
  alter column assigned_capacity set not null,
  add constraint guest_parties_contact_name_length
    check (char_length(primary_contact_name) between 1 and 160),
  add constraint guest_parties_email_length
    check (contact_email is null or char_length(contact_email) <= 254),
  add constraint guest_parties_phone_length
    check (contact_phone is null or char_length(contact_phone) <= 32),
  add constraint guest_parties_assigned_capacity_range
    check (assigned_capacity between 1 and 100);

alter table public.invitees
  add column invitee_type public.invitee_kind not null default 'named_guest',
  add column companion_of_invitee_id uuid,
  add column companion_label text,
  add column display_order integer,
  add column retired_at timestamptz,
  add column updated_at timestamptz not null default now();

with ordered as (
  select
    id,
    row_number() over (
      partition by guest_party_id
      order by created_at, id
    ) - 1 as position
  from public.invitees
)
update public.invitees invitee
set display_order = ordered.position
from ordered
where ordered.id = invitee.id;

alter table public.invitees
  alter column display_order set not null,
  add constraint invitees_id_party_unique unique (id, guest_party_id),
  add constraint invitees_display_order_nonnegative check (display_order >= 0),
  add constraint invitees_companion_label_length
    check (companion_label is null or char_length(companion_label) <= 120),
  add constraint invitees_not_own_companion
    check (companion_of_invitee_id is null or companion_of_invitee_id <> id),
  add constraint invitees_kind_relationship
    check (
      (invitee_type = 'named_guest' and companion_of_invitee_id is null)
      or (invitee_type = 'plus_one' and companion_of_invitee_id is not null)
    ),
  add constraint invitees_companion_same_party
    foreign key (companion_of_invitee_id, guest_party_id)
    references public.invitees(id, guest_party_id)
    on delete restrict;

create unique index invitees_active_party_order_unique
  on public.invitees(guest_party_id, display_order)
  where retired_at is null;

create index invitees_companion_idx
  on public.invitees(companion_of_invitee_id)
  where companion_of_invitee_id is not null;

create table public.event_schedule_items (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text check (venue_name is null or char_length(venue_name) <= 200),
  address text check (address is null or char_length(address) <= 500),
  place_id text check (place_id is null or char_length(place_id) <= 255),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  display_order integer not null check (display_order >= 0),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check ((latitude is null) = (longitude is null))
);

create unique index event_schedule_active_order_unique
  on public.event_schedule_items(event_id, display_order)
  where removed_at is null;

create index event_schedule_event_time_idx
  on public.event_schedule_items(event_id, starts_at)
  where removed_at is null;

alter table public.event_schedule_items enable row level security;
alter table public.event_schedule_items force row level security;

create policy event_schedule_items_select_member on public.event_schedule_items
  for select to authenticated using (public.can_access_event(event_id));

revoke all on public.event_schedule_items from anon, authenticated;
grant select on public.event_schedule_items to authenticated;
