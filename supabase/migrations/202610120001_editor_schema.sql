alter type public.invitee_kind add value if not exists 'unnamed_extra';

alter table public.events
  add column purge_after timestamptz;

alter table public.invitees
  add column legacy_display_name text;

alter table public.events
  add constraint events_trash_retention
  check (
    (deleted_at is null and purge_after is null)
    or (deleted_at is not null and purge_after is not null and purge_after >= deleted_at)
  );

create index events_trash_retention_idx
  on public.events(organization_id, purge_after)
  where deleted_at is not null;

create table public.invitee_contacts (
  id uuid primary key default extensions.gen_random_uuid(),
  invitee_id uuid not null references public.invitees(id) on delete cascade,
  kind public.delivery_recipient_kind not null,
  value text not null check (char_length(value) between 3 and 254),
  display_order integer not null check (display_order >= 0),
  preferred boolean not null default false,
  delivery_status text not null default 'not_sent'
    check (delivery_status in ('not_sent', 'queued', 'sent', 'failed')),
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invitee_id, kind, value)
);

create index invitee_contacts_invitee_order_idx
  on public.invitee_contacts(invitee_id, display_order);

alter table public.invitee_contacts enable row level security;
alter table public.invitee_contacts force row level security;

create policy invitee_contacts_select_member
  on public.invitee_contacts
  for select to authenticated using (
    exists (
      select 1
      from public.invitees invitee
      where invitee.id = invitee_id
        and public.can_access_event(invitee.event_id)
    )
  );

revoke all on public.invitee_contacts from anon, authenticated;
grant select on public.invitee_contacts to authenticated;
