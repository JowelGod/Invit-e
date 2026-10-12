alter table public.invitees drop constraint invitees_kind_relationship;

update public.invitees
set
  invitee_type = 'unnamed_extra',
  display_name = null,
  companion_of_invitee_id = null,
  companion_label = null,
  updated_at = now()
where invitee_type = 'plus_one';

alter table public.invitees
  add constraint invitees_kind_relationship
  check (
    (invitee_type = 'named_guest'
      and nullif(trim(display_name), '') is not null
      and companion_of_invitee_id is null)
    or (invitee_type = 'unnamed_extra'
      and display_name is null
      and companion_of_invitee_id is null)
    or (invitee_type = 'plus_one'
      and companion_of_invitee_id is not null)
  );

insert into public.invitee_contacts(invitee_id, kind, value, display_order, preferred)
select
  owner.id,
  recipient.kind,
  recipient.value,
  recipient.display_order,
  recipient.display_order = 0
from public.party_delivery_recipients recipient
join lateral (
  select invitee.id
  from public.invitees invitee
  where invitee.guest_party_id = recipient.guest_party_id
    and invitee.invitee_type = 'named_guest'
    and invitee.retired_at is null
  order by invitee.display_order, invitee.id
  limit 1
) owner on true
on conflict do nothing;

create or replace function public.get_event_delivery_state(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare payload jsonb;
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
        'id', contact.id,
        'invitee_id', contact.invitee_id,
        'kind', contact.kind,
        'value', contact.value,
        'preferred', contact.preferred,
        'delivery_status', contact.delivery_status
      ) order by invitee.display_order, contact.display_order, contact.id)
      from public.invitee_contacts contact
      join public.invitees invitee on invitee.id = contact.invitee_id
      where invitee.guest_party_id = party.id and invitee.retired_at is null
    ), '[]'::jsonb)
  ) order by party.created_at, party.id), '[]'::jsonb)
  into payload
  from public.guest_parties party
  where party.event_id = p_event_id;

  return payload;
end;
$$;

create or replace function public.save_guest_party_v4(
  p_event_id uuid,
  p_guest_party_id uuid,
  p_name text,
  p_invitees jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  party_row public.guest_parties%rowtype;
  existing_row public.invitees%rowtype;
  item jsonb;
  contact jsonb;
  new_party_id uuid;
  current_invitee_id uuid;
  desired_count integer;
  outside_count integer;
  projected_count integer;
  named_count integer;
  valid_contact_count integer := 0;
  position integer := 0;
  contact_position integer;
  recipient_position integer := 0;
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
    raise exception 'El evento no se puede editar' using errcode = '55000';
  end if;
  if nullif(trim(p_name), '') is null or jsonb_typeof(p_invitees) <> 'array' then
    raise exception 'Los datos de la invitación son inválidos' using errcode = '22023';
  end if;

  desired_count := jsonb_array_length(p_invitees);
  select count(*) into named_count
  from jsonb_array_elements(p_invitees) candidate(value)
  where coalesce(candidate.value ->> 'invitee_type', 'named_guest') = 'named_guest';
  if desired_count not between 1 and 100 or named_count < 1 then
    raise exception 'Agrega al menos un invitado nominal' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_invitees) candidate(value)
    where jsonb_typeof(candidate.value) <> 'object'
      or (candidate.value ->> 'key') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(candidate.value ->> 'invitee_type', 'named_guest')
        not in ('named_guest', 'unnamed_extra', 'plus_one')
      or (
        coalesce(candidate.value ->> 'invitee_type', 'named_guest') = 'named_guest'
        and nullif(trim(candidate.value ->> 'display_name'), '') is null
      )
      or (
        coalesce(candidate.value ->> 'invitee_type', 'named_guest') <> 'named_guest'
        and nullif(trim(candidate.value ->> 'display_name'), '') is not null
      )
      or jsonb_typeof(coalesce(candidate.value -> 'contacts', '[]'::jsonb)) <> 'array'
  ) or (
    select count(distinct candidate.value ->> 'key')
    from jsonb_array_elements(p_invitees) candidate(value)
  ) <> desired_count then
    raise exception 'La lista de boletos contiene datos inválidos' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_invitees) candidate(value),
      lateral jsonb_object_keys(candidate.value) field
    where field not in ('key', 'display_name', 'invitee_type', 'contacts')
  ) then
    raise exception 'La lista contiene campos no permitidos' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_invitees)
  loop
    if coalesce(item ->> 'invitee_type', 'named_guest') <> 'named_guest'
      and jsonb_array_length(coalesce(item -> 'contacts', '[]'::jsonb)) > 0 then
      raise exception 'Los boletos extra no pueden tener contactos' using errcode = '22023';
    end if;
    for contact in select value from jsonb_array_elements(coalesce(item -> 'contacts', '[]'::jsonb))
    loop
      if jsonb_typeof(contact) <> 'object'
        or contact ->> 'kind' not in ('email', 'phone')
        or nullif(trim(contact ->> 'value'), '') is null
        or exists (select 1 from jsonb_object_keys(contact) field where field not in ('kind', 'value'))
        or (contact ->> 'kind' = 'email' and lower(trim(contact ->> 'value'))
          !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
        or (contact ->> 'kind' = 'phone' and
          char_length(regexp_replace(contact ->> 'value', '[^0-9]', '', 'g')) not between 7 and 15) then
        raise exception 'Agrega un correo o teléfono válido' using errcode = '22023';
      end if;
      valid_contact_count := valid_contact_count + 1;
    end loop;
  end loop;
  if valid_contact_count < 1 then
    raise exception 'Agrega al menos un correo o teléfono válido' using errcode = '22023';
  end if;

  if p_guest_party_id is null then
    insert into public.guest_parties(event_id, name, primary_contact_name, assigned_capacity)
    values (p_event_id, trim(p_name), trim(p_name), desired_count)
    returning id into new_party_id;
  else
    select * into party_row from public.guest_parties
    where id = p_guest_party_id and event_id = p_event_id for update;
    if party_row.id is null then raise exception 'No autorizado' using errcode = '42501'; end if;
    new_party_id := party_row.id;
    if exists (
      select 1 from public.invitees existing
      where existing.guest_party_id = new_party_id and existing.retired_at is null
        and not exists (
          select 1 from jsonb_array_elements(p_invitees) desired(value)
          where desired.value ->> 'key' = existing.public_key::text
        )
        and (existing.response <> 'pending' or exists (
          select 1 from public.rsvp_events history,
            lateral jsonb_array_elements(history.response) response
          where history.guest_party_id = new_party_id
            and response ->> 'invitee_key' = existing.public_key::text
        ))
    ) then
      raise exception 'No se pueden eliminar boletos con respuesta o historial'
        using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_invitees) desired(value)
    join public.invitees existing on existing.public_key = (desired.value ->> 'key')::uuid
    where existing.guest_party_id <> new_party_id
  ) then
    raise exception 'Un boleto pertenece a otra invitación' using errcode = '23514';
  end if;

  select count(*) into outside_count from public.invitees
  where event_id = p_event_id and retired_at is null and response <> 'rejected'
    and guest_party_id <> new_party_id;
  select count(*) into projected_count
  from jsonb_array_elements(p_invitees) desired(value)
  left join public.invitees existing
    on existing.guest_party_id = new_party_id
    and existing.public_key = (desired.value ->> 'key')::uuid
  where existing.id is null or existing.response <> 'rejected';
  if outside_count + projected_count > event_row.capacity then
    raise exception 'No hay capacidad disponible para esos boletos' using errcode = '23514';
  end if;

  update public.invitees set display_order = display_order + 1000
  where guest_party_id = new_party_id and retired_at is null;

  for item in select value from jsonb_array_elements(p_invitees)
  loop
    select * into existing_row from public.invitees
    where guest_party_id = new_party_id and public_key = (item ->> 'key')::uuid;
    if existing_row.id is not null and existing_row.retired_at is not null then
      raise exception 'No se puede reutilizar un boleto retirado' using errcode = '23514';
    end if;
    if existing_row.id is not null and existing_row.response <> 'pending'
      and existing_row.invitee_type::text <> (case
        when coalesce(item ->> 'invitee_type', 'named_guest') = 'named_guest'
          then 'named_guest' else 'unnamed_extra' end) then
      raise exception 'No se puede cambiar el tipo de un boleto que ya respondió'
        using errcode = '23514';
    end if;

    if existing_row.id is null then
      insert into public.invitees(
        event_id, guest_party_id, public_key, display_name, invitee_type,
        companion_of_invitee_id, companion_label, display_order
      ) values (
        p_event_id, new_party_id, (item ->> 'key')::uuid,
        case when coalesce(item ->> 'invitee_type', 'named_guest') = 'named_guest'
          then trim(item ->> 'display_name') else null end,
        case when coalesce(item ->> 'invitee_type', 'named_guest') = 'named_guest'
          then 'named_guest'::public.invitee_kind else 'unnamed_extra'::public.invitee_kind end,
        null, null, position
      ) returning id into current_invitee_id;
    else
      current_invitee_id := existing_row.id;
      update public.invitees set
        display_name = case when coalesce(item ->> 'invitee_type', 'named_guest') = 'named_guest'
          then trim(item ->> 'display_name') else null end,
        invitee_type = case when coalesce(item ->> 'invitee_type', 'named_guest') = 'named_guest'
          then 'named_guest'::public.invitee_kind else 'unnamed_extra'::public.invitee_kind end,
        companion_of_invitee_id = null,
        companion_label = null,
        display_order = position,
        updated_at = now()
      where id = current_invitee_id;
    end if;

    delete from public.invitee_contacts where invitee_id = current_invitee_id;
    contact_position := 0;
    for contact in select value from jsonb_array_elements(coalesce(item -> 'contacts', '[]'::jsonb))
    loop
      insert into public.invitee_contacts(invitee_id, kind, value, display_order, preferred)
      values (
        current_invitee_id,
        (contact ->> 'kind')::public.delivery_recipient_kind,
        case when contact ->> 'kind' = 'email'
          then lower(trim(contact ->> 'value')) else trim(contact ->> 'value') end,
        contact_position,
        contact_position = 0
      );
      contact_position := contact_position + 1;
    end loop;
    position := position + 1;
  end loop;

  update public.invitees existing set retired_at = now(), updated_at = now()
  where existing.guest_party_id = new_party_id and existing.retired_at is null
    and not exists (
      select 1 from jsonb_array_elements(p_invitees) desired(value)
      where desired.value ->> 'key' = existing.public_key::text
    );

  delete from public.party_delivery_recipients where guest_party_id = new_party_id;
  for contact in
    select jsonb_build_object('kind', saved.kind, 'value', saved.value) value
    from public.invitee_contacts saved
    join public.invitees invitee on invitee.id = saved.invitee_id
    where invitee.guest_party_id = new_party_id and invitee.retired_at is null
    order by invitee.display_order, saved.display_order
  loop
    insert into public.party_delivery_recipients(guest_party_id, kind, value, display_order)
    values (
      new_party_id,
      (contact ->> 'kind')::public.delivery_recipient_kind,
      contact ->> 'value',
      recipient_position
    ) on conflict (guest_party_id, kind, value) do nothing;
    recipient_position := recipient_position + 1;
  end loop;

  select value into first_email from public.party_delivery_recipients
  where guest_party_id = new_party_id and kind = 'email' order by display_order limit 1;
  select value into first_phone from public.party_delivery_recipients
  where guest_party_id = new_party_id and kind = 'phone' order by display_order limit 1;
  update public.guest_parties set
    name = trim(p_name), primary_contact_name = trim(p_name),
    contact_email = first_email, contact_phone = first_phone,
    assigned_capacity = desired_count, updated_at = now()
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
    insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
    values (event_row.organization_id, auth.uid(), 'invitation_link.created', 'invitation_link', link_id);
  end if;

  insert into public.audit_log(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    event_row.organization_id, auth.uid(),
    case when p_guest_party_id is null then 'guest_party.created' else 'guest_party.saved' end,
    'guest_party', new_party_id,
    jsonb_build_object('tickets', desired_count, 'named_guests', named_count,
      'contacts', valid_contact_count)
  );
  return jsonb_build_object('party_id', new_party_id, 'token', token, 'has_active_link', true);
end;
$$;

create or replace function public.move_event_to_trash(p_event_id uuid)
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
  update public.invitation_links set revoked_at = coalesce(revoked_at, now())
  where guest_party_id in (select id from public.guest_parties where event_id = p_event_id);
  update public.events set deleted_at = now(), purge_after = now() + interval '30 days', updated_at = now()
  where id = p_event_id;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id,
    metadata)
  values (event_row.organization_id, auth.uid(), 'event.trashed', 'event', p_event_id,
    jsonb_build_object('retention_days', 30, 'public_links_revoked', true));
end;
$$;

create or replace function public.get_trashed_events()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', event.id,
    'title', event.title,
    'deleted_at', event.deleted_at,
    'purge_after', event.purge_after,
    'starts_at', event.starts_at,
    'timezone', event.timezone
  ) order by event.deleted_at desc), '[]'::jsonb)
  from public.events event
  join public.organization_members membership
    on membership.organization_id = event.organization_id
  where membership.user_id = auth.uid() and event.deleted_at is not null;
$$;

create or replace function public.restore_trashed_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.deleted_at is null
    or not public.has_organization_role(event_row.organization_id,
      array['owner', 'admin', 'planner']::public.app_role[]) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.events set deleted_at = null, purge_after = null, updated_at = now()
  where id = p_event_id;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id,
    metadata)
  values (event_row.organization_id, auth.uid(), 'event.restored', 'event', p_event_id,
    jsonb_build_object('public_links_remain_revoked', true));
end;
$$;

create or replace function public.purge_trashed_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype; party_ids uuid[]; link_ids uuid[];
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.deleted_at is null
    or not public.has_organization_role(event_row.organization_id,
      array['owner']::public.app_role[]) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.purge_after > now() then
    raise exception 'El periodo de retención todavía no termina' using errcode = '55000';
  end if;
  select coalesce(array_agg(id), array[]::uuid[]) into party_ids
  from public.guest_parties where event_id = p_event_id;
  select coalesce(array_agg(id), array[]::uuid[]) into link_ids
  from public.invitation_links where guest_party_id = any(party_ids);
  delete from public.rsvp_events where guest_party_id = any(party_ids);
  delete from public.events where id = p_event_id;
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id,
    metadata)
  values (event_row.organization_id, auth.uid(), 'event.purged', 'event', p_event_id,
    jsonb_build_object('pii_removed', true, 'party_count', cardinality(party_ids),
      'link_count', cardinality(link_ids)));
end;
$$;

create or replace function public.create_event_with_activity(
  p_title text,
  p_activity_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_capacity integer,
  p_venue_name text,
  p_address text,
  p_description text,
  p_timezone text default 'America/Mexico_City'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare organization_id uuid; new_event_id uuid;
begin
  organization_id := public.current_organization_id();
  if organization_id is null or not public.has_organization_role(organization_id,
    array['owner', 'admin', 'planner']::public.app_role[]) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_activity_title), '') is null
    or p_capacity not between 1 and 10000 or p_starts_at < now()
    or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'La actividad principal necesita datos y fecha válidos' using errcode = '22023';
  end if;
  insert into public.events(
    organization_id, title, starts_at, timezone, location_name, capacity, created_by
  ) values (
    organization_id, trim(p_title), p_starts_at,
    coalesce(nullif(trim(p_timezone), ''), 'America/Mexico_City'),
    nullif(trim(p_venue_name), ''), p_capacity, auth.uid()
  ) returning id into new_event_id;
  insert into public.event_schedule_items(
    event_id, title, description, starts_at, ends_at, venue_name, address, display_order
  ) values (
    new_event_id, trim(p_activity_title), nullif(trim(p_description), ''),
    p_starts_at, p_ends_at, nullif(trim(p_venue_name), ''), nullif(trim(p_address), ''), 0
  );
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id,
    metadata)
  values (organization_id, auth.uid(), 'event.created', 'event', new_event_id,
    jsonb_build_object('primary_activity_created', true));
  return new_event_id;
end;
$$;

create or replace function public.sync_event_timeline(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare item_id uuid; position integer := 0; first_item public.event_schedule_items%rowtype;
begin
  update public.event_schedule_items set display_order = display_order + 1000
  where event_id = p_event_id and removed_at is null;
  for item_id in
    select id from public.event_schedule_items
    where event_id = p_event_id and removed_at is null
    order by starts_at, id
  loop
    update public.event_schedule_items set display_order = position where id = item_id;
    position := position + 1;
  end loop;
  select * into first_item from public.event_schedule_items
  where event_id = p_event_id and removed_at is null order by starts_at, id limit 1;
  if first_item.id is not null then
    update public.events set starts_at = first_item.starts_at,
      location_name = first_item.venue_name, updated_at = now()
    where id = p_event_id;
  end if;
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
  if event_row.id is null or event_row.deleted_at is not null
    or not public.can_manage_event(p_event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if event_row.status = 'archived' then raise exception 'El evento no se puede editar' using errcode = '55000'; end if;
  if nullif(trim(p_title), '') is null or p_starts_at < now()
    or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'La actividad necesita una fecha futura y un rango válido' using errcode = '22023';
  end if;
  select coalesce(max(display_order) + 1, 0) into next_order
  from public.event_schedule_items where event_id = p_event_id and removed_at is null;
  insert into public.event_schedule_items(
    event_id, title, description, starts_at, ends_at, venue_name, address,
    place_id, latitude, longitude, display_order
  ) values (
    p_event_id, trim(p_title), nullif(trim(p_description), ''), p_starts_at, p_ends_at,
    nullif(trim(p_venue_name), ''), nullif(trim(p_address), ''), nullif(trim(p_place_id), ''),
    p_latitude, p_longitude, next_order
  ) returning id into new_id;
  perform public.sync_event_timeline(p_event_id);
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
declare item_row public.event_schedule_items%rowtype; event_row public.events%rowtype;
begin
  select * into item_row from public.event_schedule_items where id = p_item_id for update;
  if item_row.id is null or not public.can_manage_event(item_row.event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into event_row from public.events where id = item_row.event_id;
  if event_row.status = 'archived' or item_row.removed_at is not null then
    raise exception 'La actividad no se puede editar' using errcode = '55000';
  end if;
  if nullif(trim(p_title), '') is null
    or (p_starts_at is distinct from item_row.starts_at and p_starts_at < now())
    or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'La actividad necesita una fecha futura y un rango válido' using errcode = '22023';
  end if;
  update public.event_schedule_items set
    title = trim(p_title), description = nullif(trim(p_description), ''),
    starts_at = p_starts_at, ends_at = p_ends_at,
    venue_name = nullif(trim(p_venue_name), ''), address = nullif(trim(p_address), ''),
    place_id = nullif(trim(p_place_id), ''), latitude = p_latitude,
    longitude = p_longitude, updated_at = now()
  where id = p_item_id;
  perform public.sync_event_timeline(item_row.event_id);
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id)
  values (event_row.organization_id, auth.uid(), 'schedule_item.updated', 'schedule_item', p_item_id);
end;
$$;

create or replace function public.remove_schedule_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare item_row public.event_schedule_items%rowtype; event_row public.events%rowtype;
begin
  select * into item_row from public.event_schedule_items where id = p_item_id for update;
  if item_row.id is null or not public.can_manage_event(item_row.event_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into event_row from public.events where id = item_row.event_id;
  if event_row.status = 'archived' then raise exception 'El evento no se puede editar' using errcode = '55000'; end if;
  if (select count(*) from public.event_schedule_items
      where event_id = item_row.event_id and removed_at is null) <= 1 then
    raise exception 'El evento debe conservar una actividad principal' using errcode = '23514';
  end if;
  update public.event_schedule_items set removed_at = now(), updated_at = now() where id = p_item_id;
  perform public.sync_event_timeline(item_row.event_id);
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id,
    metadata)
  values (event_row.organization_id, auth.uid(), 'schedule_item.removed', 'schedule_item', p_item_id,
    jsonb_build_object('title', item_row.title, 'starts_at', item_row.starts_at));
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
          'title', schedule.title, 'description', schedule.description,
          'starts_at', schedule.starts_at, 'ends_at', schedule.ends_at,
          'venue_name', schedule.venue_name, 'address', schedule.address,
          'place_id', schedule.place_id, 'latitude', schedule.latitude,
          'longitude', schedule.longitude
        ) order by schedule.starts_at, schedule.id)
        from public.event_schedule_items schedule
        where schedule.event_id = event.id and schedule.removed_at is null
      ), '[]'::jsonb)
    ),
    'party', jsonb_build_object('name', party.name),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', place.public_key,
        'name', case when place.invitee_type = 'named_guest' then place.display_name
          else 'Invitado adicional ' || place.extra_number end,
        'status', place.response,
        'type', case when place.invitee_type = 'named_guest' then 'named_guest'
          else 'unnamed_extra' end,
        'companion_label', null,
        'companion_of_key', null
      ) order by place.display_order, place.id)
      from (
        select invitee.*,
          row_number() over (partition by invitee.invitee_type order by invitee.display_order, invitee.id)
            as extra_number
        from public.invitees invitee
        where invitee.guest_party_id = party.id and invitee.retired_at is null
      ) place
    ), '[]'::jsonb)
  ) into payload
  from public.invitation_links link
  join public.guest_parties party on party.id = link.guest_party_id
  join public.events event on event.id = party.event_id
  where link.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and link.revoked_at is null and event.deleted_at is null and event.status <> 'archived'
    and (link.expires_at is null or link.expires_at > now());
  return payload;
end;
$$;

revoke all on function public.save_guest_party_v4(uuid, uuid, text, jsonb) from public;
revoke all on function public.move_event_to_trash(uuid) from public;
revoke all on function public.get_trashed_events() from public;
revoke all on function public.restore_trashed_event(uuid) from public;
revoke all on function public.purge_trashed_event(uuid) from public;
revoke all on function public.create_event_with_activity(text, text, timestamptz, timestamptz,
  integer, text, text, text, text) from public;
revoke all on function public.sync_event_timeline(uuid) from public;

grant execute on function public.save_guest_party_v4(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.move_event_to_trash(uuid) to authenticated;
grant execute on function public.get_trashed_events() to authenticated;
grant execute on function public.restore_trashed_event(uuid) to authenticated;
grant execute on function public.purge_trashed_event(uuid) to authenticated;
grant execute on function public.create_event_with_activity(text, text, timestamptz, timestamptz,
  integer, text, text, text, text) to authenticated;
