create or replace function public.can_manage_event(p_event_id uuid)
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
      and membership.role in ('owner', 'admin', 'planner')
  );
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
  position integer := 0;
begin
  select * into event_row
  from public.events
  where id = p_event_id
  for update;

  if event_row.id is null or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if event_row.status = 'archived' then
    raise exception 'El evento está archivado' using errcode = '55000';
  end if;

  if nullif(trim(p_name), '') is null
    or jsonb_typeof(p_invitees) <> 'array'
    or jsonb_array_length(p_invitees) not between 1 and 100 then
    raise exception 'El grupo y sus lugares son inválidos' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_invitees) item
    where jsonb_typeof(item) <> 'object'
  ) or exists (
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
  where event_id = p_event_id
    and retired_at is null
    and response <> 'rejected';

  if active_count + requested_count > event_row.capacity then
    raise exception 'No hay capacidad disponible para esos lugares' using errcode = '23514';
  end if;

  insert into public.guest_parties(
    event_id, name, primary_contact_name, assigned_capacity
  ) values (
    p_event_id, trim(p_name), trim(p_name), requested_count
  ) returning id into new_party_id;

  for invitee in select value from jsonb_array_elements(p_invitees)
  loop
    insert into public.invitees(
      event_id, guest_party_id, display_name, display_order
    ) values (
      p_event_id,
      new_party_id,
      nullif(trim(invitee ->> 'display_name'), ''),
      position
    );
    position := position + 1;
  end loop;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    event_row.organization_id, auth.uid(), 'guest_party.created',
    'guest_party', new_party_id, jsonb_build_object('places', requested_count)
  );

  return new_party_id;
end;
$$;

create or replace function public.create_guest_party_v2(
  p_event_id uuid,
  p_name text,
  p_primary_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_assigned_capacity integer,
  p_invitees jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  new_party_id uuid;
  item jsonb;
  new_invitee_id uuid;
  active_count integer;
  supplied_count integer;
  position integer := 0;
begin
  select * into event_row from public.events where id = p_event_id for update;

  if event_row.id is null or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then
    raise exception 'El evento está archivado' using errcode = '55000';
  end if;
  if nullif(trim(p_name), '') is null
    or nullif(trim(p_primary_contact_name), '') is null
    or p_assigned_capacity not between 1 and 100
    or jsonb_typeof(p_invitees) <> 'array' then
    raise exception 'Los datos del grupo son inválidos' using errcode = '22023';
  end if;

  supplied_count := jsonb_array_length(p_invitees);
  if supplied_count > p_assigned_capacity then
    raise exception 'Hay más personas que lugares asignados' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_invitees) value
    where jsonb_typeof(value) <> 'object'
  ) or exists (
    select 1
    from jsonb_array_elements(p_invitees) value,
      lateral jsonb_object_keys(value) field
    where field not in (
      'client_key', 'display_name', 'invitee_type',
      'companion_of_key', 'companion_label'
    )
  ) then
    raise exception 'La lista de personas contiene campos no permitidos' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_invitees) value
    where not (value ? 'client_key')
      or (value ->> 'client_key') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(value ->> 'invitee_type', 'named_guest') not in ('named_guest', 'plus_one')
  ) or (
    select count(distinct value ->> 'client_key')
    from jsonb_array_elements(p_invitees) value
  ) <> supplied_count then
    raise exception 'Cada persona necesita una clave temporal única' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_invitees) value
    where coalesce(value ->> 'invitee_type', 'named_guest') = 'plus_one'
      and not exists (
        select 1 from jsonb_array_elements(p_invitees) owner
        where owner ->> 'client_key' = value ->> 'companion_of_key'
          and coalesce(owner ->> 'invitee_type', 'named_guest') = 'named_guest'
      )
  ) then
    raise exception 'Cada acompañante debe pertenecer a una persona del mismo grupo' using errcode = '22023';
  end if;

  select count(*) into active_count
  from public.invitees
  where event_id = p_event_id and retired_at is null and response <> 'rejected';
  if active_count + p_assigned_capacity > event_row.capacity then
    raise exception 'No hay capacidad disponible para esos lugares' using errcode = '23514';
  end if;

  insert into public.guest_parties(
    event_id, name, primary_contact_name, contact_email, contact_phone,
    assigned_capacity
  ) values (
    p_event_id, trim(p_name), trim(p_primary_contact_name),
    nullif(lower(trim(p_contact_email)), ''), nullif(trim(p_contact_phone), ''),
    p_assigned_capacity
  ) returning id into new_party_id;

  for item in
    select value from jsonb_array_elements(p_invitees) value
    where coalesce(value ->> 'invitee_type', 'named_guest') = 'named_guest'
  loop
    insert into public.invitees(
      event_id, guest_party_id, public_key, display_name, invitee_type,
      display_order
    ) values (
      p_event_id, new_party_id, (item ->> 'client_key')::uuid,
      nullif(trim(item ->> 'display_name'), ''), 'named_guest', position
    );
    position := position + 1;
  end loop;

  for item in
    select value from jsonb_array_elements(p_invitees) value
    where value ->> 'invitee_type' = 'plus_one'
  loop
    select id into new_invitee_id
    from public.invitees
    where guest_party_id = new_party_id
      and public_key = (item ->> 'companion_of_key')::uuid;
    insert into public.invitees(
      event_id, guest_party_id, public_key, display_name, invitee_type,
      companion_of_invitee_id, companion_label, display_order
    ) values (
      p_event_id, new_party_id, (item ->> 'client_key')::uuid,
      nullif(trim(item ->> 'display_name'), ''), 'plus_one', new_invitee_id,
      coalesce(nullif(trim(item ->> 'companion_label'), ''), 'Acompañante'),
      position
    );
    position := position + 1;
  end loop;

  while position < p_assigned_capacity loop
    insert into public.invitees(event_id, guest_party_id, display_order)
    values (p_event_id, new_party_id, position);
    position := position + 1;
  end loop;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    event_row.organization_id, auth.uid(), 'guest_party.created', 'guest_party',
    new_party_id, jsonb_build_object('places', p_assigned_capacity)
  );
  return new_party_id;
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
  if event_row.id is null or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then
    raise exception 'El evento está archivado' using errcode = '55000';
  end if;
  if nullif(trim(p_title), '') is null or p_capacity not between 1 and 10000
    or nullif(trim(p_timezone), '') is null then
    raise exception 'Datos del evento inválidos' using errcode = '22023';
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

create or replace function public.change_event_status(
  p_event_id uuid,
  p_status public.event_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then
    raise exception 'Un evento archivado no se puede reactivar' using errcode = '55000';
  end if;
  if p_status = 'archived' then
    update public.events set status = 'archived', archived_at = now(), updated_at = now()
    where id = p_event_id;
  elsif p_status = 'published' then
    update public.events set status = 'published',
      published_at = coalesce(published_at, now()), archived_at = null, updated_at = now()
    where id = p_event_id;
  elsif p_status = 'draft' then
    update public.events set status = 'draft', published_at = null,
      archived_at = null, updated_at = now()
    where id = p_event_id;
  else
    raise exception 'Estado inválido' using errcode = '22023';
  end if;
  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    event_row.organization_id, auth.uid(), 'event.status_changed', 'event', p_event_id,
    jsonb_build_object('from', event_row.status, 'to', p_status)
  );
end;
$$;

create or replace function public.change_event_template(
  p_event_id uuid,
  p_template_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status <> 'draft' or exists (
    select 1 from public.invitation_links link
    join public.guest_parties party on party.id = link.guest_party_id
    where party.event_id = p_event_id and link.revoked_at is null
  ) then
    raise exception 'La plantilla queda bloqueada al publicar o generar invitaciones'
      using errcode = '55000';
  end if;
  if p_template_id is null or p_template_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'Plantilla inválida' using errcode = '22023';
  end if;
  update public.events set template_id = p_template_id, updated_at = now()
  where id = p_event_id;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (event_row.organization_id, auth.uid(), 'event.template_changed', 'event', p_event_id);
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
declare event_row public.events%rowtype; new_id uuid; next_order integer;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then
    raise exception 'El evento está archivado' using errcode = '55000';
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
declare item_row public.event_schedule_items%rowtype; organization_id uuid; event_status public.event_status;
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

create or replace function public.remove_schedule_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare item_row public.event_schedule_items%rowtype; organization_id uuid; event_status public.event_status;
begin
  select * into item_row from public.event_schedule_items where id = p_item_id for update;
  if item_row.id is null or not public.can_manage_event(item_row.event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select status, events.organization_id into event_status, organization_id
  from public.events where id = item_row.event_id;
  if event_status = 'archived' then
    raise exception 'El evento está archivado' using errcode = '55000';
  end if;
  update public.event_schedule_items set removed_at = coalesce(removed_at, now()), updated_at = now()
  where id = p_item_id;
  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    organization_id, auth.uid(), 'schedule_item.removed', 'schedule_item', p_item_id,
    jsonb_build_object('snapshot', to_jsonb(item_row))
  );
end;
$$;

create or replace function public.reorder_schedule_items(p_event_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype; active_count integer; item_id uuid; position integer := 0;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then raise exception 'El evento está archivado' using errcode = '55000'; end if;
  select count(*) into active_count from public.event_schedule_items
  where event_id = p_event_id and removed_at is null;
  if coalesce(array_length(p_item_ids, 1), 0) <> active_count
    or (select count(distinct value) from unnest(p_item_ids) value) <> active_count
    or exists (
      select 1 from unnest(p_item_ids) value
      where not exists (
        select 1 from public.event_schedule_items item
        where item.id = value and item.event_id = p_event_id and item.removed_at is null
      )
    ) then
    raise exception 'El orden debe incluir todas las actividades activas una sola vez'
      using errcode = '22023';
  end if;
  update public.event_schedule_items set display_order = display_order + active_count + 1
  where event_id = p_event_id and removed_at is null;
  foreach item_id in array p_item_ids loop
    update public.event_schedule_items set display_order = position, updated_at = now()
    where id = item_id;
    position := position + 1;
  end loop;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (event_row.organization_id, auth.uid(), 'schedule_item.reordered', 'event', p_event_id);
end;
$$;

create or replace function public.update_guest_party(
  p_guest_party_id uuid,
  p_name text,
  p_primary_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_assigned_capacity integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  party_row public.guest_parties%rowtype;
  event_row public.events%rowtype;
  current_count integer;
  delta integer;
  next_order integer;
  candidate record;
  retired_count integer := 0;
begin
  select * into party_row from public.guest_parties where id = p_guest_party_id for update;
  if party_row.id is null or not public.can_manage_event(party_row.event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into event_row from public.events where id = party_row.event_id for update;
  if event_row.status = 'archived' then raise exception 'El evento está archivado' using errcode = '55000'; end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_primary_contact_name), '') is null
    or p_assigned_capacity not between 1 and 100 then
    raise exception 'Los datos del grupo son inválidos' using errcode = '22023';
  end if;
  select count(*), coalesce(max(display_order) + 1, 0)
  into current_count, next_order from public.invitees
  where guest_party_id = p_guest_party_id and retired_at is null;
  delta := p_assigned_capacity - current_count;
  if delta > 0 then
    if (select count(*) from public.invitees where event_id = party_row.event_id
        and retired_at is null and response <> 'rejected') + delta > event_row.capacity then
      raise exception 'No hay capacidad disponible para esos lugares' using errcode = '23514';
    end if;
    for position in 1..delta loop
      insert into public.invitees(event_id, guest_party_id, display_order)
      values (party_row.event_id, p_guest_party_id, next_order);
      next_order := next_order + 1;
    end loop;
  elsif delta < 0 then
    for candidate in
      select invitee.id
      from public.invitees invitee
      where invitee.guest_party_id = p_guest_party_id
        and invitee.retired_at is null and invitee.response = 'pending'
        and not exists (
          select 1 from public.invitees companion
          where companion.companion_of_invitee_id = invitee.id and companion.retired_at is null
        )
        and not exists (
          select 1 from public.rsvp_events history,
            lateral jsonb_array_elements(history.response) response
          where history.guest_party_id = p_guest_party_id
            and response ->> 'invitee_key' = invitee.public_key::text
        )
      order by (invitee.display_name is null) desc, invitee.display_order desc
      limit -delta
    loop
      update public.invitees set retired_at = now(), updated_at = now()
      where id = candidate.id;
      retired_count := retired_count + 1;
    end loop;
    if retired_count <> -delta then
      raise exception 'No se pueden retirar lugares respondidos, con historial o con acompañantes activos'
        using errcode = '23514';
    end if;
  end if;
  update public.guest_parties set
    name = trim(p_name), primary_contact_name = trim(p_primary_contact_name),
    contact_email = nullif(lower(trim(p_contact_email)), ''),
    contact_phone = nullif(trim(p_contact_phone), ''),
    assigned_capacity = p_assigned_capacity, updated_at = now()
  where id = p_guest_party_id;
  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    event_row.organization_id, auth.uid(), 'guest_party.updated', 'guest_party',
    p_guest_party_id, jsonb_build_object('capacity', p_assigned_capacity)
  );
end;
$$;

create or replace function public.update_invitee(
  p_invitee_id uuid,
  p_display_name text,
  p_invitee_type public.invitee_kind,
  p_companion_of_invitee_id uuid default null,
  p_companion_label text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare invitee_row public.invitees%rowtype; event_row public.events%rowtype;
begin
  select * into invitee_row from public.invitees where id = p_invitee_id for update;
  if invitee_row.id is null or not public.can_manage_event(invitee_row.event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into event_row from public.events where id = invitee_row.event_id;
  if event_row.status = 'archived' or invitee_row.retired_at is not null then
    raise exception 'El lugar no se puede editar' using errcode = '55000';
  end if;
  if invitee_row.response <> 'pending' and p_invitee_type <> invitee_row.invitee_type then
    raise exception 'No se puede cambiar el tipo de un lugar respondido' using errcode = '23514';
  end if;
  if p_invitee_type = 'plus_one' and not exists (
    select 1 from public.invitees owner
    where owner.id = p_companion_of_invitee_id
      and owner.guest_party_id = invitee_row.guest_party_id
      and owner.invitee_type = 'named_guest' and owner.retired_at is null
  ) then
    raise exception 'El acompañante debe vincularse a una persona del mismo grupo'
      using errcode = '22023';
  end if;
  if p_invitee_type = 'plus_one' and exists (
    select 1 from public.invitees child
    where child.companion_of_invitee_id = p_invitee_id and child.retired_at is null
  ) then
    raise exception 'El lugar tiene acompañantes vinculados' using errcode = '23514';
  end if;
  update public.invitees set
    display_name = nullif(trim(p_display_name), ''), invitee_type = p_invitee_type,
    companion_of_invitee_id = case when p_invitee_type = 'plus_one' then p_companion_of_invitee_id else null end,
    companion_label = case when p_invitee_type = 'plus_one'
      then coalesce(nullif(trim(p_companion_label), ''), 'Acompañante') else null end,
    updated_at = now()
  where id = p_invitee_id;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (event_row.organization_id, auth.uid(), 'invitee.updated', 'invitee', p_invitee_id);
end;
$$;

create or replace function public.reorder_invitees(p_guest_party_id uuid, p_invitee_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare party_row public.guest_parties%rowtype; event_row public.events%rowtype; active_count integer; invitee_id uuid; position integer := 0;
begin
  select * into party_row from public.guest_parties where id = p_guest_party_id for update;
  if party_row.id is null or not public.can_manage_event(party_row.event_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into event_row from public.events where id = party_row.event_id;
  if event_row.status = 'archived' then raise exception 'El evento está archivado' using errcode = '55000'; end if;
  select count(*) into active_count from public.invitees where guest_party_id = p_guest_party_id and retired_at is null;
  if coalesce(array_length(p_invitee_ids, 1), 0) <> active_count
    or (select count(distinct value) from unnest(p_invitee_ids) value) <> active_count
    or exists (
      select 1 from unnest(p_invitee_ids) value
      where not exists (
        select 1 from public.invitees invitee
        where invitee.id = value and invitee.guest_party_id = p_guest_party_id and invitee.retired_at is null
      )
    ) then raise exception 'El orden debe incluir todos los lugares activos una sola vez' using errcode = '22023'; end if;
  update public.invitees set display_order = display_order + active_count + 1
  where guest_party_id = p_guest_party_id and retired_at is null;
  foreach invitee_id in array p_invitee_ids loop
    update public.invitees set display_order = position, updated_at = now() where id = invitee_id;
    position := position + 1;
  end loop;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (event_row.organization_id, auth.uid(), 'invitee.reordered', 'guest_party', p_guest_party_id);
end;
$$;

create or replace function public.retire_invitee(p_invitee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare invitee_row public.invitees%rowtype; event_row public.events%rowtype;
begin
  select * into invitee_row from public.invitees where id = p_invitee_id for update;
  if invitee_row.id is null or not public.can_manage_event(invitee_row.event_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into event_row from public.events where id = invitee_row.event_id;
  if event_row.status = 'archived' then raise exception 'El evento está archivado' using errcode = '55000'; end if;
  if invitee_row.response <> 'pending' or exists (
    select 1 from public.rsvp_events history, lateral jsonb_array_elements(history.response) response
    where history.guest_party_id = invitee_row.guest_party_id
      and response ->> 'invitee_key' = invitee_row.public_key::text
  ) then raise exception 'No se puede retirar un lugar que ya respondió' using errcode = '23514'; end if;
  if exists (
    select 1 from public.invitees child
    where child.companion_of_invitee_id = p_invitee_id and child.retired_at is null
  ) then raise exception 'Retira primero sus acompañantes' using errcode = '23514'; end if;
  if (select count(*) from public.invitees where guest_party_id = invitee_row.guest_party_id and retired_at is null) <= 1 then
    raise exception 'El grupo debe conservar al menos un lugar' using errcode = '23514';
  end if;
  update public.invitees set retired_at = now(), updated_at = now() where id = p_invitee_id;
  update public.guest_parties set assigned_capacity = assigned_capacity - 1, updated_at = now()
  where id = invitee_row.guest_party_id;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (event_row.organization_id, auth.uid(), 'invitee.retired', 'invitee', p_invitee_id);
end;
$$;

create or replace function public.create_invitation_link(p_guest_party_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare organization_id uuid; event_status public.event_status; token text; link_id uuid;
begin
  select event.organization_id, event.status into organization_id, event_status
  from public.guest_parties party join public.events event on event.id = party.event_id
  where party.id = p_guest_party_id;
  if organization_id is null or not public.has_organization_role(
    organization_id, array['owner', 'admin', 'planner']::public.app_role[]
  ) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if event_status = 'archived' then raise exception 'El evento está archivado' using errcode = '55000'; end if;
  perform 1 from public.guest_parties where id = p_guest_party_id for update;
  update public.invitation_links set revoked_at = now()
  where guest_party_id = p_guest_party_id and revoked_at is null;
  token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invitation_links(guest_party_id, token_hash, created_by)
  values (p_guest_party_id, extensions.digest(pg_catalog.convert_to(token, 'UTF8'), 'sha256'), auth.uid())
  returning id into link_id;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (organization_id, auth.uid(), 'invitation_link.created', 'invitation_link', link_id);
  return token;
end;
$$;

create or replace function public.event_capacity_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare event_capacity integer; total_places integer; pending_places integer; confirmed_places integer; rejected_places integer; answered integer;
begin
  if not public.can_access_event(p_event_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select capacity into event_capacity from public.events where id = p_event_id;
  select count(*), count(*) filter (where response = 'pending'),
    count(*) filter (where response = 'confirmed'), count(*) filter (where response = 'rejected')
  into total_places, pending_places, confirmed_places, rejected_places
  from public.invitees where event_id = p_event_id and retired_at is null;
  answered := confirmed_places + rejected_places;
  return jsonb_build_object(
    'capacity', event_capacity,
    'assigned', total_places,
    'unassigned', greatest(event_capacity - total_places, 0),
    'pending', pending_places,
    'confirmed', confirmed_places,
    'rejected', rejected_places,
    'available_to_reassign', greatest(event_capacity - pending_places - confirmed_places, 0),
    'response_percentage', case when total_places = 0 then 0 else round(answered * 100.0 / total_places, 1) end
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
declare payload jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select jsonb_build_object(
    'event', jsonb_build_object(
      'title', event.title, 'starts_at', event.starts_at, 'timezone', event.timezone,
      'location_name', event.location_name, 'content', event.public_content,
      'template_id', event.template_id,
      'schedule', coalesce((
        select jsonb_agg(jsonb_build_object(
          'title', item.title, 'description', item.description,
          'starts_at', item.starts_at, 'ends_at', item.ends_at,
          'venue_name', item.venue_name, 'address', item.address,
          'place_id', item.place_id, 'latitude', item.latitude, 'longitude', item.longitude
        ) order by item.display_order, item.id)
        from public.event_schedule_items item
        where item.event_id = event.id and item.removed_at is null
      ), '[]'::jsonb)
    ),
    'party', jsonb_build_object('name', party.name),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', invitee.public_key, 'name', invitee.display_name,
        'status', invitee.response, 'type', invitee.invitee_type,
        'companion_label', invitee.companion_label,
        'companion_of_key', owner.public_key
      ) order by invitee.display_order, invitee.id)
      from public.invitees invitee
      left join public.invitees owner on owner.id = invitee.companion_of_invitee_id
      where invitee.guest_party_id = party.id and invitee.retired_at is null
    ), '[]'::jsonb)
  ) into payload
  from public.invitation_links link
  join public.guest_parties party on party.id = link.guest_party_id
  join public.events event on event.id = party.event_id
  where link.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and link.revoked_at is null and (link.expires_at is null or link.expires_at > now())
    and event.status <> 'archived';
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
  link_row public.invitation_links%rowtype; party_row public.guest_parties%rowtype;
  event_row public.events%rowtype; response_item jsonb; requested_count integer;
  matched_count integer; projected_active_count integer;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_idempotency_key is null
    or jsonb_typeof(p_responses) <> 'array' or jsonb_array_length(p_responses) not between 1 and 100 then
    raise exception 'Respuesta inválida' using errcode = '22023';
  end if;
  select * into link_row from public.invitation_links link
  where link.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and link.revoked_at is null and (link.expires_at is null or link.expires_at > now())
  for update;
  if link_row.id is null then return null; end if;
  select * into party_row from public.guest_parties where id = link_row.guest_party_id;
  select * into event_row from public.events where id = party_row.event_id for update;
  if event_row.status = 'archived' then return null; end if;
  if exists (
    select 1 from public.rsvp_events history
    where history.invitation_link_id = link_row.id and history.idempotency_key = p_idempotency_key
  ) then return public.get_public_invitation(p_token); end if;
  if exists (
    select 1 from jsonb_array_elements(p_responses) item where jsonb_typeof(item) <> 'object'
  ) or exists (
    select 1 from jsonb_array_elements(p_responses) item
    where not (item ? 'invitee_key' and item ? 'status')
      or item ->> 'status' not in ('confirmed', 'rejected')
      or (item ->> 'invitee_key') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) or exists (
    select 1 from jsonb_array_elements(p_responses) item,
      lateral jsonb_object_keys(item) field
    where field not in ('invitee_key', 'status')
  ) then raise exception 'La respuesta contiene campos no permitidos' using errcode = '22023'; end if;
  requested_count := jsonb_array_length(p_responses);
  if (select count(distinct item ->> 'invitee_key') from jsonb_array_elements(p_responses) item) <> requested_count then
    raise exception 'Cada lugar sólo puede responder una vez' using errcode = '22023';
  end if;
  perform 1 from public.invitees invitee
  join jsonb_array_elements(p_responses) item
    on invitee.public_key = (item ->> 'invitee_key')::uuid
  where invitee.guest_party_id = party_row.id and invitee.retired_at is null
  for update of invitee;
  get diagnostics matched_count = row_count;
  if matched_count <> requested_count then
    raise exception 'Uno o más lugares no pertenecen a esta invitación' using errcode = '22023';
  end if;
  select count(*) filter (
      where invitee.response in ('pending', 'confirmed') and invitee.retired_at is null
        and not exists (
          select 1 from jsonb_array_elements(p_responses) item
          where invitee.public_key = (item ->> 'invitee_key')::uuid
        )
    ) + (select count(*) from jsonb_array_elements(p_responses) item where item ->> 'status' = 'confirmed')
  into projected_active_count from public.invitees invitee where invitee.event_id = party_row.event_id;
  if projected_active_count > event_row.capacity then
    raise exception 'El lugar ya fue reasignado y el evento no tiene capacidad disponible' using errcode = '23514';
  end if;
  for response_item in select value from jsonb_array_elements(p_responses) loop
    update public.invitees set
      response = (response_item ->> 'status')::public.invitee_response,
      responded_at = now(), updated_at = now()
    where guest_party_id = party_row.id and retired_at is null
      and public_key = (response_item ->> 'invitee_key')::uuid;
  end loop;
  insert into public.rsvp_events(invitation_link_id, guest_party_id, idempotency_key, response)
  values (link_row.id, party_row.id, p_idempotency_key, p_responses);
  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    event_row.organization_id, null, 'rsvp.submitted', 'guest_party', party_row.id,
    jsonb_build_object('places_answered', requested_count)
  );
  return public.get_public_invitation(p_token);
end;
$$;

revoke all on function public.can_manage_event(uuid) from public;
revoke all on function public.create_guest_party_v2(uuid, text, text, text, text, integer, jsonb) from public;
revoke all on function public.update_event_details(uuid, text, timestamptz, integer, text, text) from public;
revoke all on function public.change_event_status(uuid, public.event_status) from public;
revoke all on function public.change_event_template(uuid, text) from public;
revoke all on function public.create_schedule_item(uuid, text, text, timestamptz, timestamptz, text, text, text, numeric, numeric) from public;
revoke all on function public.update_schedule_item(uuid, text, text, timestamptz, timestamptz, text, text, text, numeric, numeric) from public;
revoke all on function public.remove_schedule_item(uuid) from public;
revoke all on function public.reorder_schedule_items(uuid, uuid[]) from public;
revoke all on function public.update_guest_party(uuid, text, text, text, text, integer) from public;
revoke all on function public.update_invitee(uuid, text, public.invitee_kind, uuid, text) from public;
revoke all on function public.reorder_invitees(uuid, uuid[]) from public;
revoke all on function public.retire_invitee(uuid) from public;

grant execute on function public.can_manage_event(uuid) to authenticated;
grant execute on function public.create_guest_party_v2(uuid, text, text, text, text, integer, jsonb) to authenticated;
grant execute on function public.update_event_details(uuid, text, timestamptz, integer, text, text) to authenticated;
grant execute on function public.change_event_status(uuid, public.event_status) to authenticated;
grant execute on function public.change_event_template(uuid, text) to authenticated;
grant execute on function public.create_schedule_item(uuid, text, text, timestamptz, timestamptz, text, text, text, numeric, numeric) to authenticated;
grant execute on function public.update_schedule_item(uuid, text, text, timestamptz, timestamptz, text, text, text, numeric, numeric) to authenticated;
grant execute on function public.remove_schedule_item(uuid) to authenticated;
grant execute on function public.reorder_schedule_items(uuid, uuid[]) to authenticated;
grant execute on function public.update_guest_party(uuid, text, text, text, text, integer) to authenticated;
grant execute on function public.update_invitee(uuid, text, public.invitee_kind, uuid, text) to authenticated;
grant execute on function public.reorder_invitees(uuid, uuid[]) to authenticated;
grant execute on function public.retire_invitee(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'event_schedule_items'
  ) then
    alter publication supabase_realtime add table public.event_schedule_items;
  end if;
end;
$$;
