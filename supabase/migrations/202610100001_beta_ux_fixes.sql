alter table public.events
  add column deleted_at timestamptz;

create or replace function public.can_access_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1
    from public.events event
    join public.organization_members membership
      on membership.organization_id = event.organization_id
    where event.id = p_event_id
      and event.deleted_at is null
      and membership.user_id = auth.uid()
  );
$;

create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1
    from public.events event
    join public.organization_members membership
      on membership.organization_id = event.organization_id
    where event.id = p_event_id
      and event.deleted_at is null
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'planner')
  );
$;

create type public.delivery_recipient_kind as enum ('email', 'phone');

create table public.party_delivery_recipients (
  id uuid primary key default extensions.gen_random_uuid(),
  guest_party_id uuid not null references public.guest_parties(id) on delete cascade,
  kind public.delivery_recipient_kind not null,
  value text not null check (char_length(value) between 3 and 254),
  display_order integer not null check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_party_id, kind, value)
);

create index party_delivery_recipients_party_order_idx
  on public.party_delivery_recipients(guest_party_id, display_order);

alter table public.party_delivery_recipients enable row level security;
alter table public.party_delivery_recipients force row level security;

create policy party_delivery_recipients_select_member
  on public.party_delivery_recipients
  for select to authenticated using (
    exists (
      select 1
      from public.guest_parties party
      where party.id = guest_party_id
        and public.can_access_event(party.event_id)
    )
  );

drop policy events_select_member on public.events;
create policy events_select_member on public.events
  for select to authenticated using (
    deleted_at is null and public.is_organization_member(organization_id)
  );

revoke all on public.party_delivery_recipients from anon, authenticated;
grant select on public.party_delivery_recipients to authenticated;

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
  if nullif(trim(p_title), '') is null
    or p_capacity not between 1 and 10000
    or p_starts_at < now() then
    raise exception 'La fecha del evento debe ser actual o futura' using errcode = '22023';
  end if;

  insert into public.events(
    organization_id, title, starts_at, timezone, location_name, capacity, created_by
  ) values (
    organization_id, trim(p_title), p_starts_at,
    coalesce(nullif(trim(p_timezone), ''), 'America/Mexico_City'),
    nullif(trim(p_location_name), ''), p_capacity, auth.uid()
  ) returning id into new_event_id;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id
  ) values (organization_id, auth.uid(), 'event.created', 'event', new_event_id);
  return new_event_id;
end;
$$;

create or replace function public.update_event_details(
  p_event_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_capacity integer,
  p_location_name text,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  active_count integer;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.deleted_at is not null
    or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then
    raise exception 'El evento está archivado' using errcode = '55000';
  end if;
  if nullif(trim(p_title), '') is null or p_capacity not between 1 and 10000
    or nullif(trim(p_timezone), '') is null then
    raise exception 'Datos del evento inválidos' using errcode = '22023';
  end if;
  if p_starts_at is distinct from event_row.starts_at and p_starts_at < now() then
    raise exception 'La nueva fecha del evento debe ser actual o futura' using errcode = '22023';
  end if;
  select count(*) into active_count from public.invitees
  where event_id = p_event_id and retired_at is null and response <> 'rejected';
  if p_capacity < active_count then
    raise exception 'La capacidad no puede ser menor que los lugares pendientes y confirmados'
      using errcode = '23514';
  end if;

  update public.events set
    title = trim(p_title), starts_at = p_starts_at, capacity = p_capacity,
    location_name = nullif(trim(p_location_name), ''), timezone = trim(p_timezone),
    updated_at = now()
  where id = p_event_id;

  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (event_row.organization_id, auth.uid(), 'event.updated', 'event', p_event_id);
end;
$$;

create or replace function public.create_schedule_item(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_name text,
  p_address text,
  p_place_id text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  new_id uuid;
  next_order integer;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.deleted_at is not null
    or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then
    raise exception 'El evento está archivado' using errcode = '55000';
  end if;
  if nullif(trim(p_title), '') is null or p_starts_at < now()
    or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'La actividad necesita una fecha futura y un rango válido'
      using errcode = '22023';
  end if;

  select coalesce(max(display_order) + 1, 0) into next_order
  from public.event_schedule_items where event_id = p_event_id and removed_at is null;

  insert into public.event_schedule_items(
    event_id, title, description, starts_at, ends_at, venue_name, address,
    place_id, latitude, longitude, display_order
  ) values (
    p_event_id, trim(p_title), nullif(trim(p_description), ''), p_starts_at, p_ends_at,
    nullif(trim(p_venue_name), ''), nullif(trim(p_address), ''),
    nullif(trim(p_place_id), ''), p_latitude, p_longitude, next_order
  ) returning id into new_id;

  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (event_row.organization_id, auth.uid(), 'schedule_item.created', 'schedule_item', new_id);
  return new_id;
end;
$$;

create or replace function public.update_schedule_item(
  p_item_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_name text,
  p_address text,
  p_place_id text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.event_schedule_items%rowtype;
  organization_id uuid;
  event_status public.event_status;
begin
  select * into item_row from public.event_schedule_items where id = p_item_id for update;
  if item_row.id is null or not public.can_manage_event(item_row.event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select status, events.organization_id into event_status, organization_id
  from public.events where id = item_row.event_id;
  if event_status = 'archived' or item_row.removed_at is not null then
    raise exception 'La actividad no se puede editar' using errcode = '55000';
  end if;
  if nullif(trim(p_title), '') is null
    or (p_starts_at is distinct from item_row.starts_at and p_starts_at < now())
    or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'La actividad necesita una fecha futura y un rango válido'
      using errcode = '22023';
  end if;

  update public.event_schedule_items set
    title = trim(p_title), description = nullif(trim(p_description), ''),
    starts_at = p_starts_at, ends_at = p_ends_at,
    venue_name = nullif(trim(p_venue_name), ''), address = nullif(trim(p_address), ''),
    place_id = nullif(trim(p_place_id), ''), latitude = p_latitude,
    longitude = p_longitude, updated_at = now()
  where id = p_item_id;

  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (organization_id, auth.uid(), 'schedule_item.updated', 'schedule_item', p_item_id);
end;
$$;

create or replace function public.get_event_delivery_state(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if not public.can_access_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'party_id', party.id,
    'has_active_link', exists (
      select 1 from public.invitation_links link
      where link.guest_party_id = party.id
        and link.revoked_at is null
        and (link.expires_at is null or link.expires_at > now())
    ),
    'recipients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', recipient.id, 'kind', recipient.kind, 'value', recipient.value
      ) order by recipient.display_order, recipient.id)
      from public.party_delivery_recipients recipient
      where recipient.guest_party_id = party.id
    ), '[]'::jsonb)
  ) order by party.created_at, party.id), '[]'::jsonb)
  into payload
  from public.guest_parties party
  where party.event_id = p_event_id;

  return payload;
end;
$$;

create or replace function public.save_guest_party_v3(
  p_event_id uuid,
  p_guest_party_id uuid,
  p_name text,
  p_invitees jsonb,
  p_recipients jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  party_row public.guest_parties%rowtype;
  new_party_id uuid;
  item jsonb;
  recipient jsonb;
  desired_count integer;
  outside_count integer;
  projected_count integer;
  position integer := 0;
  existing_row public.invitees%rowtype;
  owner_id uuid;
  token text;
  link_id uuid;
  first_email text;
  first_phone text;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.deleted_at is not null
    or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then
    raise exception 'El evento está archivado' using errcode = '55000';
  end if;
  if nullif(trim(p_name), '') is null
    or jsonb_typeof(p_invitees) <> 'array'
    or jsonb_typeof(p_recipients) <> 'array' then
    raise exception 'Los datos del grupo son inválidos' using errcode = '22023';
  end if;

  desired_count := jsonb_array_length(p_invitees);
  if desired_count not between 1 and 100 then
    raise exception 'Agrega entre una y cien personas' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_invitees) invitee(value)
    where jsonb_typeof(invitee.value) <> 'object'
      or not (invitee.value ? 'key')
      or (invitee.value ->> 'key') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(invitee.value ->> 'invitee_type', 'named_guest')
        not in ('named_guest', 'plus_one')
      or nullif(trim(invitee.value ->> 'display_name'), '') is null
  ) or exists (
    select 1
    from jsonb_array_elements(p_invitees) invitee(value),
      lateral jsonb_object_keys(invitee.value) field
    where field not in ('key', 'display_name', 'invitee_type', 'companion_of_key')
  ) or (
    select count(distinct invitee.value ->> 'key')
    from jsonb_array_elements(p_invitees) invitee(value)
  ) <> desired_count then
    raise exception 'La lista de personas contiene datos inválidos' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_invitees) invitee(value)
    where invitee.value ->> 'invitee_type' = 'plus_one'
      and not exists (
        select 1 from jsonb_array_elements(p_invitees) owner(value)
        where owner.value ->> 'key' = invitee.value ->> 'companion_of_key'
          and coalesce(owner.value ->> 'invitee_type', 'named_guest') = 'named_guest'
      )
  ) then
    raise exception 'Cada acompañante debe pertenecer a una persona del grupo'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_recipients) delivery(value)
    where jsonb_typeof(delivery.value) <> 'object'
      or delivery.value ->> 'kind' not in ('email', 'phone')
      or nullif(trim(delivery.value ->> 'value'), '') is null
  ) or exists (
    select 1
    from jsonb_array_elements(p_recipients) delivery(value),
      lateral jsonb_object_keys(delivery.value) field
    where field not in ('kind', 'value')
  ) then
    raise exception 'Los destinatarios contienen datos inválidos' using errcode = '22023';
  end if;

  if p_guest_party_id is null then
    insert into public.guest_parties(
      event_id, name, primary_contact_name, assigned_capacity
    ) values (
      p_event_id, trim(p_name), trim(p_name), desired_count
    ) returning id into new_party_id;
  else
    select * into party_row from public.guest_parties
    where id = p_guest_party_id and event_id = p_event_id for update;
    if party_row.id is null then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    new_party_id := party_row.id;

    if exists (
      select 1
      from public.invitees existing
      where existing.guest_party_id = new_party_id
        and existing.retired_at is null
        and not exists (
          select 1 from jsonb_array_elements(p_invitees) desired(value)
          where desired.value ->> 'key' = existing.public_key::text
        )
        and (
          existing.response <> 'pending'
          or exists (
            select 1 from public.rsvp_events history,
              lateral jsonb_array_elements(history.response) response
            where history.guest_party_id = new_party_id
              and response ->> 'invitee_key' = existing.public_key::text
          )
        )
    ) then
      raise exception 'No se pueden eliminar invitados con respuesta o historial'
        using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_invitees) desired(value)
    join public.invitees existing
      on existing.public_key = (desired.value ->> 'key')::uuid
    where existing.guest_party_id <> new_party_id
  ) then
    raise exception 'Una persona pertenece a otro grupo' using errcode = '23514';
  end if;

  select count(*) into outside_count
  from public.invitees
  where event_id = p_event_id and retired_at is null
    and response <> 'rejected' and guest_party_id <> new_party_id;

  select count(*) into projected_count
  from jsonb_array_elements(p_invitees) desired(value)
  left join public.invitees existing
    on existing.guest_party_id = new_party_id
    and existing.public_key = (desired.value ->> 'key')::uuid
  where existing.id is null or existing.response <> 'rejected';

  if outside_count + projected_count > event_row.capacity then
    raise exception 'No hay capacidad disponible para esas personas' using errcode = '23514';
  end if;

  update public.invitees set display_order = display_order + 1000
  where guest_party_id = new_party_id and retired_at is null;

  for item in
    select invitee.value
    from jsonb_array_elements(p_invitees) invitee(value)
    where coalesce(invitee.value ->> 'invitee_type', 'named_guest') = 'named_guest'
  loop
    select * into existing_row from public.invitees
    where guest_party_id = new_party_id
      and public_key = (item ->> 'key')::uuid;
    if existing_row.id is null then
      insert into public.invitees(
        event_id, guest_party_id, public_key, display_name, invitee_type, display_order
      ) values (
        p_event_id, new_party_id, (item ->> 'key')::uuid,
        trim(item ->> 'display_name'), 'named_guest', position
      );
    else
      if existing_row.retired_at is not null then
        raise exception 'No se puede reutilizar una persona eliminada' using errcode = '23514';
      end if;
      if existing_row.response <> 'pending' and existing_row.invitee_type <> 'named_guest' then
        raise exception 'No se puede cambiar el tipo de una persona que ya respondió'
          using errcode = '23514';
      end if;
      update public.invitees set
        display_name = trim(item ->> 'display_name'),
        invitee_type = 'named_guest',
        companion_of_invitee_id = null,
        companion_label = null,
        display_order = position,
        updated_at = now()
      where id = existing_row.id;
    end if;
    position := position + 1;
  end loop;

  for item in
    select invitee.value
    from jsonb_array_elements(p_invitees) invitee(value)
    where invitee.value ->> 'invitee_type' = 'plus_one'
  loop
    select id into owner_id from public.invitees
    where guest_party_id = new_party_id
      and public_key = (item ->> 'companion_of_key')::uuid
      and invitee_type = 'named_guest' and retired_at is null;

    select * into existing_row from public.invitees
    where guest_party_id = new_party_id
      and public_key = (item ->> 'key')::uuid;
    if existing_row.id is null then
      insert into public.invitees(
        event_id, guest_party_id, public_key, display_name, invitee_type,
        companion_of_invitee_id, companion_label, display_order
      ) values (
        p_event_id, new_party_id, (item ->> 'key')::uuid,
        trim(item ->> 'display_name'), 'plus_one', owner_id,
        trim(item ->> 'display_name'), position
      );
    else
      if existing_row.retired_at is not null then
        raise exception 'No se puede reutilizar una persona eliminada' using errcode = '23514';
      end if;
      if existing_row.response <> 'pending' and existing_row.invitee_type <> 'plus_one' then
        raise exception 'No se puede cambiar el tipo de una persona que ya respondió'
          using errcode = '23514';
      end if;
      if exists (
        select 1 from public.invitees child
        where child.companion_of_invitee_id = existing_row.id
          and child.retired_at is null
      ) then
        raise exception 'No se puede convertir una persona con acompañantes activos'
          using errcode = '23514';
      end if;
      update public.invitees set
        display_name = trim(item ->> 'display_name'),
        invitee_type = 'plus_one',
        companion_of_invitee_id = owner_id,
        companion_label = trim(item ->> 'display_name'),
        display_order = position,
        updated_at = now()
      where id = existing_row.id;
    end if;
    position := position + 1;
  end loop;

  update public.invitees existing set retired_at = now(), updated_at = now()
  where existing.guest_party_id = new_party_id
    and existing.retired_at is null
    and not exists (
      select 1 from jsonb_array_elements(p_invitees) desired(value)
      where desired.value ->> 'key' = existing.public_key::text
    );

  delete from public.party_delivery_recipients where guest_party_id = new_party_id;
  position := 0;
  for recipient in select delivery.value from jsonb_array_elements(p_recipients) delivery(value)
  loop
    insert into public.party_delivery_recipients(
      guest_party_id, kind, value, display_order
    ) values (
      new_party_id,
      (recipient ->> 'kind')::public.delivery_recipient_kind,
      case when recipient ->> 'kind' = 'email'
        then lower(trim(recipient ->> 'value'))
        else trim(recipient ->> 'value') end,
      position
    );
    position := position + 1;
  end loop;

  select value into first_email from public.party_delivery_recipients
  where guest_party_id = new_party_id and kind = 'email'
  order by display_order limit 1;
  select value into first_phone from public.party_delivery_recipients
  where guest_party_id = new_party_id and kind = 'phone'
  order by display_order limit 1;

  update public.guest_parties set
    name = trim(p_name),
    primary_contact_name = trim(p_name),
    contact_email = first_email,
    contact_phone = first_phone,
    assigned_capacity = desired_count,
    updated_at = now()
  where id = new_party_id;

  if not exists (
    select 1 from public.invitation_links
    where guest_party_id = new_party_id and revoked_at is null
  ) then
    token := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.invitation_links(guest_party_id, token_hash, created_by)
    values (
      new_party_id,
      extensions.digest(pg_catalog.convert_to(token, 'UTF8'), 'sha256'),
      auth.uid()
    ) returning id into link_id;
    insert into public.audit_log(
      organization_id, actor_user_id, action, entity_type, entity_id
    ) values (
      event_row.organization_id, auth.uid(), 'invitation_link.created',
      'invitation_link', link_id
    );
  end if;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    event_row.organization_id, auth.uid(),
    case when p_guest_party_id is null then 'guest_party.created' else 'guest_party.saved' end,
    'guest_party', new_party_id,
    jsonb_build_object('people', desired_count, 'recipients', jsonb_array_length(p_recipients))
  );

  return jsonb_build_object(
    'party_id', new_party_id,
    'token', token,
    'has_active_link', true
  );
end;
$$;

create or replace function public.reset_guest_party_responses(p_guest_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  party_row public.guest_parties%rowtype;
  organization_id uuid;
  changed_count integer;
begin
  select * into party_row from public.guest_parties where id = p_guest_party_id for update;
  if party_row.id is null or not public.can_manage_event(party_row.event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select events.organization_id into organization_id
  from public.events where id = party_row.event_id and status <> 'archived' and deleted_at is null;
  if organization_id is null then
    raise exception 'El grupo no se puede modificar' using errcode = '55000';
  end if;

  update public.invitees set response = 'pending', responded_at = null, updated_at = now()
  where guest_party_id = p_guest_party_id and retired_at is null and response <> 'pending';
  get diagnostics changed_count = row_count;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    organization_id, auth.uid(), 'rsvp.reset', 'guest_party', p_guest_party_id,
    jsonb_build_object('places_reset', changed_count, 'history_preserved', true)
  );
end;
$$;

create or replace function public.delete_draft_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.deleted_at is not null
    or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status <> 'draft'
    or exists (select 1 from public.invitation_links link
      join public.guest_parties party on party.id = link.guest_party_id
      where party.event_id = p_event_id)
    or exists (select 1 from public.rsvp_events history
      join public.guest_parties party on party.id = history.guest_party_id
      where party.event_id = p_event_id) then
    raise exception 'Este evento conserva enlaces o historial y debe archivarse'
      using errcode = '23514';
  end if;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id
  ) values (
    event_row.organization_id, auth.uid(), 'event.deleted', 'event', p_event_id
  );
  update public.events set deleted_at = now(), updated_at = now() where id = p_event_id;
end;
$$;

revoke all on function public.get_event_delivery_state(uuid) from public;
revoke all on function public.save_guest_party_v3(uuid, uuid, text, jsonb, jsonb) from public;
revoke all on function public.reset_guest_party_responses(uuid) from public;
revoke all on function public.delete_draft_event(uuid) from public;

grant execute on function public.get_event_delivery_state(uuid) to authenticated;
grant execute on function public.save_guest_party_v3(uuid, uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.reset_guest_party_responses(uuid) to authenticated;
grant execute on function public.delete_draft_event(uuid) to authenticated;
