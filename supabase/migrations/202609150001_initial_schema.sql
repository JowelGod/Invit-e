create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('owner', 'admin', 'planner', 'viewer');
create type public.event_status as enum ('draft', 'published', 'archived');
create type public.invitee_response as enum ('pending', 'confirmed', 'rejected');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  is_personal boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  default_organization_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz not null,
  timezone text not null default 'America/Mexico_City',
  location_name text check (location_name is null or char_length(location_name) <= 200),
  capacity integer not null check (capacity between 1 and 10000),
  status public.event_status not null default 'draft',
  public_content jsonb not null default '{}'::jsonb check (jsonb_typeof(public_content) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guest_parties (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);

create table public.invitees (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_party_id uuid not null,
  public_key uuid not null default extensions.gen_random_uuid() unique,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  response public.invitee_response not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (guest_party_id, event_id)
    references public.guest_parties(id, event_id) on delete cascade
);

create index invitees_event_response_idx on public.invitees(event_id, response);
create index invitees_party_idx on public.invitees(guest_party_id);

create table public.invitation_links (
  id uuid primary key default extensions.gen_random_uuid(),
  guest_party_id uuid not null references public.guest_parties(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index one_active_invitation_link_per_party
  on public.invitation_links(guest_party_id)
  where revoked_at is null;

create table public.rsvp_events (
  id bigint generated always as identity primary key,
  invitation_link_id uuid not null references public.invitation_links(id) on delete restrict,
  guest_party_id uuid not null references public.guest_parties(id) on delete restrict,
  idempotency_key uuid not null,
  response jsonb not null check (jsonb_typeof(response) = 'array'),
  submitted_at timestamptz not null default now(),
  unique (invitation_link_id, idempotency_key)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_organization_created_idx
  on public.audit_log(organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.events enable row level security;
alter table public.guest_parties enable row level security;
alter table public.invitees enable row level security;
alter table public.invitation_links enable row level security;
alter table public.rsvp_events enable row level security;
alter table public.audit_log enable row level security;

alter table public.organizations force row level security;
alter table public.profiles force row level security;
alter table public.organization_members force row level security;
alter table public.events force row level security;
alter table public.guest_parties force row level security;
alter table public.invitees force row level security;
alter table public.invitation_links force row level security;
alter table public.rsvp_events force row level security;
alter table public.audit_log force row level security;

create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(
  p_organization_id uuid,
  p_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role = any(p_roles)
  );
$$;

create or replace function public.can_access_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events event
    join public.organization_members membership
      on membership.organization_id = event.organization_id
    where event.id = p_event_id
      and membership.user_id = auth.uid()
  );
$$;

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy organizations_select_member on public.organizations
  for select to authenticated using (public.is_organization_member(id));

create policy organization_members_select_member on public.organization_members
  for select to authenticated using (public.is_organization_member(organization_id));

create policy events_select_member on public.events
  for select to authenticated using (public.is_organization_member(organization_id));

create policy guest_parties_select_member on public.guest_parties
  for select to authenticated using (public.can_access_event(event_id));

create policy invitees_select_member on public.invitees
  for select to authenticated using (public.can_access_event(event_id));

create policy rsvp_events_select_member on public.rsvp_events
  for select to authenticated using (
    exists (
      select 1
      from public.guest_parties party
      where party.id = guest_party_id
        and public.can_access_event(party.event_id)
    )
  );

create policy audit_log_select_privileged on public.audit_log
  for select to authenticated using (
    public.has_organization_role(organization_id, array['owner', 'admin']::public.app_role[])
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_id uuid;
  person_name text;
begin
  person_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'Organizador'), '@', 1)
  );
  person_name := left(person_name, 120);

  insert into public.organizations(name, is_personal, created_by)
  values (person_name, true, new.id)
  returning id into organization_id;

  insert into public.profiles(id, full_name, default_organization_id)
  values (new.id, person_name, organization_id);

  insert into public.organization_members(organization_id, user_id, role)
  values (organization_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.default_organization_id
  from public.profiles profile
  where profile.id = auth.uid();
$$;

create or replace function public.create_event(
  p_title text,
  p_starts_at timestamptz,
  p_capacity integer,
  p_location_name text default null,
  p_timezone text default 'America/Mexico_City'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_id uuid;
  new_event_id uuid;
begin
  organization_id := public.current_organization_id();

  if organization_id is null or not public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'planner']::public.app_role[]
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if nullif(trim(p_title), '') is null or p_capacity not between 1 and 10000 then
    raise exception 'Datos del evento inválidos' using errcode = '22023';
  end if;

  insert into public.events(
    organization_id, title, starts_at, timezone, location_name, capacity, created_by
  ) values (
    organization_id,
    trim(p_title),
    p_starts_at,
    coalesce(nullif(trim(p_timezone), ''), 'America/Mexico_City'),
    nullif(trim(p_location_name), ''),
    p_capacity,
    auth.uid()
  ) returning id into new_event_id;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id
  ) values (organization_id, auth.uid(), 'event.created', 'event', new_event_id);

  return new_event_id;
end;
$$;

create or replace function public.create_guest_party(
  p_event_id uuid,
  p_name text,
  p_invitees jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  new_party_id uuid;
  invitee jsonb;
  requested_count integer;
  active_count integer;
begin
  select * into event_row
  from public.events
  where id = p_event_id
  for update;

  if event_row.id is null or not public.has_organization_role(
    event_row.organization_id,
    array['owner', 'admin', 'planner']::public.app_role[]
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if nullif(trim(p_name), '') is null
    or jsonb_typeof(p_invitees) <> 'array'
    or jsonb_array_length(p_invitees) not between 1 and 100 then
    raise exception 'El grupo y sus lugares son inválidos' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_invitees) item
    where jsonb_typeof(item) <> 'object'
  ) then
    raise exception 'Cada lugar debe ser un objeto' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_invitees) item,
      lateral jsonb_object_keys(item) field
    where field <> 'display_name'
  ) then
    raise exception 'Cada lugar sólo acepta display_name' using errcode = '22023';
  end if;

  requested_count := jsonb_array_length(p_invitees);
  select count(*) into active_count
  from public.invitees
  where event_id = p_event_id and response <> 'rejected';

  if active_count + requested_count > event_row.capacity then
    raise exception 'No hay capacidad disponible para esos lugares' using errcode = '23514';
  end if;

  insert into public.guest_parties(event_id, name)
  values (p_event_id, trim(p_name))
  returning id into new_party_id;

  for invitee in select value from jsonb_array_elements(p_invitees)
  loop
    insert into public.invitees(event_id, guest_party_id, display_name)
    values (
      p_event_id,
      new_party_id,
      nullif(trim(invitee ->> 'display_name'), '')
    );
  end loop;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id,
    metadata
  ) values (
    event_row.organization_id,
    auth.uid(),
    'guest_party.created',
    'guest_party',
    new_party_id,
    jsonb_build_object('places', requested_count)
  );

  return new_party_id;
end;
$$;

create or replace function public.create_invitation_link(p_guest_party_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_id uuid;
  token text;
  link_id uuid;
begin
  select event.organization_id into organization_id
  from public.guest_parties party
  join public.events event on event.id = party.event_id
  where party.id = p_guest_party_id;

  if organization_id is null or not public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'planner']::public.app_role[]
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  perform 1 from public.guest_parties where id = p_guest_party_id for update;

  update public.invitation_links
  set revoked_at = now()
  where guest_party_id = p_guest_party_id and revoked_at is null;

  token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invitation_links(guest_party_id, token_hash, created_by)
  values (
    p_guest_party_id,
    extensions.digest(pg_catalog.convert_to(token, 'UTF8'), 'sha256'),
    auth.uid()
  ) returning id into link_id;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id
  ) values (organization_id, auth.uid(), 'invitation_link.created', 'invitation_link', link_id);

  return token;
end;
$$;

create or replace function public.revoke_invitation_link(p_guest_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_id uuid;
begin
  select event.organization_id into organization_id
  from public.guest_parties party
  join public.events event on event.id = party.event_id
  where party.id = p_guest_party_id;

  if organization_id is null or not public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'planner']::public.app_role[]
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.invitation_links
  set revoked_at = now()
  where guest_party_id = p_guest_party_id and revoked_at is null;
end;
$$;

create or replace function public.event_capacity_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_capacity integer;
  total_places integer;
  pending_places integer;
  confirmed_places integer;
  rejected_places integer;
begin
  if not public.can_access_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select capacity into event_capacity from public.events where id = p_event_id;
  select
    count(*),
    count(*) filter (where response = 'pending'),
    count(*) filter (where response = 'confirmed'),
    count(*) filter (where response = 'rejected')
  into total_places, pending_places, confirmed_places, rejected_places
  from public.invitees where event_id = p_event_id;

  return jsonb_build_object(
    'capacity', event_capacity,
    'unassigned', greatest(event_capacity - total_places, 0),
    'pending', pending_places,
    'confirmed', confirmed_places,
    'rejected', rejected_places,
    'available_to_reassign', greatest(event_capacity - pending_places - confirmed_places, 0)
  );
end;
$$;

create or replace function public.get_public_invitation(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    return null;
  end if;

  select jsonb_build_object(
    'event', jsonb_build_object(
      'title', event.title,
      'starts_at', event.starts_at,
      'timezone', event.timezone,
      'location_name', event.location_name,
      'content', event.public_content
    ),
    'party', jsonb_build_object('name', party.name),
    'places', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', invitee.public_key,
          'name', invitee.display_name,
          'status', invitee.response
        ) order by invitee.created_at, invitee.id
      )
      from public.invitees invitee
      where invitee.guest_party_id = party.id
    ), '[]'::jsonb)
  ) into payload
  from public.invitation_links link
  join public.guest_parties party on party.id = link.guest_party_id
  join public.events event on event.id = party.event_id
  where link.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now());

  return payload;
end;
$$;

create or replace function public.respond_to_invitation(
  p_token text,
  p_responses jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.invitation_links%rowtype;
  party_row public.guest_parties%rowtype;
  organization_id uuid;
  response_item jsonb;
  requested_count integer;
  matched_count integer;
  event_capacity integer;
  projected_active_count integer;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$'
    or p_idempotency_key is null
    or jsonb_typeof(p_responses) <> 'array'
    or jsonb_array_length(p_responses) not between 1 and 100 then
    raise exception 'Respuesta inválida' using errcode = '22023';
  end if;

  select * into link_row
  from public.invitation_links link
  where link.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now())
  for update;

  if link_row.id is null then
    return null;
  end if;

  if exists (
    select 1 from public.rsvp_events event
    where event.invitation_link_id = link_row.id
      and event.idempotency_key = p_idempotency_key
  ) then
    return public.get_public_invitation(p_token);
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_responses) item
    where jsonb_typeof(item) <> 'object'
  ) then
    raise exception 'La respuesta contiene campos no permitidos' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_responses) item
    where not (item ? 'invitee_key' and item ? 'status')
      or item ->> 'status' not in ('confirmed', 'rejected')
      or (item ->> 'invitee_key') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'La respuesta contiene campos no permitidos' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_responses) item,
      lateral jsonb_object_keys(item) field
    where field not in ('invitee_key', 'status')
  ) then
    raise exception 'La respuesta contiene campos no permitidos' using errcode = '22023';
  end if;

  requested_count := jsonb_array_length(p_responses);
  if (
    select count(distinct item ->> 'invitee_key')
    from jsonb_array_elements(p_responses) item
  ) <> requested_count then
    raise exception 'Cada lugar sólo puede responder una vez' using errcode = '22023';
  end if;

  select * into party_row from public.guest_parties where id = link_row.guest_party_id;

  select capacity into event_capacity
  from public.events
  where id = party_row.event_id
  for update;

  perform 1
  from public.invitees invitee
  join jsonb_array_elements(p_responses) item
    on invitee.public_key = (item ->> 'invitee_key')::uuid
  where invitee.guest_party_id = party_row.id
  for update of invitee;
  get diagnostics matched_count = row_count;

  if matched_count <> requested_count then
    raise exception 'Uno o más lugares no pertenecen a esta invitación' using errcode = '22023';
  end if;

  select
    count(*) filter (
      where invitee.response in ('pending', 'confirmed')
        and not exists (
          select 1
          from jsonb_array_elements(p_responses) item
          where invitee.public_key = (item ->> 'invitee_key')::uuid
        )
    )
    + (
      select count(*)
      from jsonb_array_elements(p_responses) item
      where item ->> 'status' = 'confirmed'
    )
  into projected_active_count
  from public.invitees invitee
  where invitee.event_id = party_row.event_id;

  if projected_active_count > event_capacity then
    raise exception 'El lugar ya fue reasignado y el evento no tiene capacidad disponible'
      using errcode = '23514';
  end if;

  for response_item in select value from jsonb_array_elements(p_responses)
  loop
    update public.invitees
    set
      response = (response_item ->> 'status')::public.invitee_response,
      responded_at = now()
    where guest_party_id = party_row.id
      and public_key = (response_item ->> 'invitee_key')::uuid;
  end loop;

  insert into public.rsvp_events(
    invitation_link_id, guest_party_id, idempotency_key, response
  ) values (link_row.id, party_row.id, p_idempotency_key, p_responses);

  select event.organization_id into organization_id
  from public.events event where event.id = party_row.event_id;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id,
    metadata
  ) values (
    organization_id,
    null,
    'rsvp.submitted',
    'guest_party',
    party_row.id,
    jsonb_build_object('places_answered', requested_count)
  );

  return public.get_public_invitation(p_token);
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.organizations, public.organization_members,
  public.events, public.guest_parties, public.invitees, public.rsvp_events,
  public.audit_log to authenticated;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.has_organization_role(uuid, public.app_role[]) from public;
revoke all on function public.can_access_event(uuid) from public;
revoke all on function public.current_organization_id() from public;
revoke all on function public.create_event(text, timestamptz, integer, text, text) from public;
revoke all on function public.create_guest_party(uuid, text, jsonb) from public;
revoke all on function public.create_invitation_link(uuid) from public;
revoke all on function public.revoke_invitation_link(uuid) from public;
revoke all on function public.event_capacity_summary(uuid) from public;
revoke all on function public.get_public_invitation(text) from public;
revoke all on function public.respond_to_invitation(text, jsonb, uuid) from public;
revoke all on function public.handle_new_user() from public;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.can_access_event(uuid) to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.create_event(text, timestamptz, integer, text, text) to authenticated;
grant execute on function public.create_guest_party(uuid, text, jsonb) to authenticated;
grant execute on function public.create_invitation_link(uuid) to authenticated;
grant execute on function public.revoke_invitation_link(uuid) to authenticated;
grant execute on function public.event_capacity_summary(uuid) to authenticated;
grant execute on function public.get_public_invitation(text) to anon, authenticated;
grant execute on function public.respond_to_invitation(text, jsonb, uuid) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'invitees'
  ) then
    alter publication supabase_realtime add table public.invitees;
  end if;
end;
$$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg']
)
on conflict (id) do nothing;

create policy event_media_select_member on storage.objects
  for select to authenticated using (
    bucket_id = 'event-media'
    and public.is_organization_member(((storage.foldername(name))[1])::uuid)
  );

create policy event_media_insert_manager on storage.objects
  for insert to authenticated with check (
    bucket_id = 'event-media'
    and public.has_organization_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin', 'planner']::public.app_role[]
    )
  );

create policy event_media_update_manager on storage.objects
  for update to authenticated using (
    bucket_id = 'event-media'
    and public.has_organization_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin', 'planner']::public.app_role[]
    )
  ) with check (
    bucket_id = 'event-media'
    and public.has_organization_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin', 'planner']::public.app_role[]
    )
  );

create policy event_media_delete_manager on storage.objects
  for delete to authenticated using (
    bucket_id = 'event-media'
    and public.has_organization_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin', 'planner']::public.app_role[]
    )
  );
