begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
  (
    '91000000-0000-4000-8000-000000000009',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'editor-owner@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Editor Owner"}', now(), now()
  ),
  (
    '92000000-0000-4000-8000-000000000009',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'editor-outsider@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Editor Outsider"}', now(), now()
  ),
  (
    '93000000-0000-4000-8000-000000000009',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'editor-planner@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Editor Planner"}', now(), now()
  );

create temp table editor_state(event_id uuid, party_id uuid, token text, organization_id uuid);
insert into editor_state default values;
grant all on editor_state to authenticated;
grant select on editor_state to anon;

update editor_state state
set organization_id = profile.default_organization_id
from public.profiles profile
where profile.id = '91000000-0000-4000-8000-000000000009';

insert into public.organization_members(organization_id, user_id, role)
select organization_id, '93000000-0000-4000-8000-000000000009', 'planner'
from editor_state;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000009', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update editor_state set event_id = public.create_event_with_activity(
  'Evento editor', 'Fiesta', now() + interval '30 days', now() + interval '30 days 4 hours',
  10, 'Salón', 'Calle Uno', 'Actividad principal', 'America/Mexico_City'
);

select is((select count(*)::integer from public.event_schedule_items), 1,
  'crear evento incluye una actividad principal');
select is(
  (select starts_at from public.events where id = (select event_id from editor_state)),
  (select starts_at from public.event_schedule_items where event_id = (select event_id from editor_state)),
  'events.starts_at queda sincronizado con la primera actividad'
);

select lives_ok(
  format(
    'select public.create_schedule_item(%L::uuid,%L,%L,now() + interval ''20 days'',null,%L,%L)',
    (select event_id from editor_state), 'Gathering', 'Bienvenida', 'Jardín', 'Calle Dos'
  ), 'se agrega una actividad anterior'
);
select is(
  (select title from public.event_schedule_items
    where event_id = (select event_id from editor_state) and removed_at is null
    order by display_order limit 1),
  'Gathering', 'la agenda se ordena cronológicamente'
);
select is(
  (select title from public.event_schedule_items
    where event_id = (select event_id from editor_state) and removed_at is null
    order by starts_at limit 1),
  'Gathering', 'el orden visible coincide con fecha y hora'
);

with saved as (
  select public.save_guest_party_v4(
    (select event_id from editor_state), null, 'Amigos',
    '[
      {"key":"94000000-0000-4000-8000-000000000009","display_name":"Maya","invitee_type":"named_guest","contacts":[{"kind":"email","value":"MAYA@EXAMPLE.TEST"}]},
      {"key":"95000000-0000-4000-8000-000000000009","display_name":"Ivanna","invitee_type":"named_guest","contacts":[{"kind":"phone","value":"+52 55 1234 5678"}]},
      {"key":"96000000-0000-4000-8000-000000000009","display_name":null,"invitee_type":"unnamed_extra","contacts":[]},
      {"key":"97000000-0000-4000-8000-000000000009","display_name":null,"invitee_type":"unnamed_extra","contacts":[]},
      {"key":"98000000-0000-4000-8000-000000000009","display_name":null,"invitee_type":"unnamed_extra","contacts":[]}
    ]'::jsonb
  ) result
)
update editor_state set party_id = (saved.result ->> 'party_id')::uuid,
  token = saved.result ->> 'token' from saved;

select is((select count(*)::integer from public.invitees
  where guest_party_id = (select party_id from editor_state)), 5,
  'cada boleto extra conserva una fila independiente');
select is((select count(*)::integer from public.invitees
  where invitee_type = 'unnamed_extra'), 3, 'se permiten varios boletos extra sin persona asociada');
select ok(not exists(select 1 from public.invitees
  where invitee_type = 'unnamed_extra' and (display_name is not null or companion_of_invitee_id is not null)),
  'los boletos extra no tienen nombre editable ni vínculo obligatorio');
select is((select count(*)::integer from public.invitee_contacts), 2,
  'los contactos pertenecen a invitados nominales');
select is((select value from public.invitee_contacts where kind = 'email'),
  'maya@example.test', 'el correo se normaliza');
select is((select assigned_capacity from public.guest_parties
  where id = (select party_id from editor_state)), 5, 'la capacidad deriva de todos los boletos');
select is((select string_agg(invitee_type::text, ',' order by display_order) from public.invitees
  where guest_party_id = (select party_id from editor_state)),
  'named_guest,named_guest,unnamed_extra,unnamed_extra,unnamed_extra',
  'el orden de invitados y extras persiste');
select is(jsonb_array_length(public.get_public_invitation((select token from editor_state)) -> 'places'),
  5, 'el enlace público incluye todos los boletos');
select is(public.get_public_invitation((select token from editor_state)) -> 'places' -> 2 ->> 'name',
  'Invitado adicional 1', 'el nombre del boleto extra se genera automáticamente');
select ok(not (public.get_public_invitation((select token from editor_state))::text
  ~* '(example.test|1234 5678|delivery_status)'), 'la invitación pública no expone contactos');

select throws_ok(
  format(
    'select public.save_guest_party_v4(%L::uuid,null,%L,%L::jsonb)',
    (select event_id from editor_state), 'Sin contacto',
    '[{"key":"99000000-0000-4000-8000-000000000009","display_name":"Solo","invitee_type":"named_guest","contacts":[]}]'
  ), '22023', 'Agrega al menos un correo o teléfono válido',
  'cada invitación requiere al menos un canal válido'
);

select lives_ok(
  format(
    'select public.save_guest_party_v4(%L::uuid,%L::uuid,%L,%L::jsonb)',
    (select event_id from editor_state), (select party_id from editor_state), 'Amigos',
    '[
      {"key":"94000000-0000-4000-8000-000000000009","display_name":"Maya Actualizada","invitee_type":"named_guest","contacts":[{"kind":"email","value":"maya.nueva@example.test"}]},
      {"key":"95000000-0000-4000-8000-000000000009","display_name":"Ivanna","invitee_type":"named_guest","contacts":[{"kind":"phone","value":"+52 55 1234 5678"}]},
      {"key":"96000000-0000-4000-8000-000000000009","display_name":null,"invitee_type":"unnamed_extra","contacts":[]},
      {"key":"97000000-0000-4000-8000-000000000009","display_name":null,"invitee_type":"unnamed_extra","contacts":[]},
      {"key":"98000000-0000-4000-8000-000000000009","display_name":null,"invitee_type":"unnamed_extra","contacts":[]}
    ]'
  ), 'la edición completa persiste transaccionalmente'
);
select is(public.get_public_invitation((select token from editor_state)) -> 'places' -> 0 ->> 'name',
  'Maya Actualizada', 'el enlace público existente refleja la edición');
select is((select value from public.invitee_contacts where kind = 'email'),
  'maya.nueva@example.test', 'el contacto editado persiste al recargar');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000009', true);
select throws_ok(format('select public.get_event_delivery_state(%L::uuid)',
  (select event_id from editor_state)), '42501', 'No autorizado',
  'otra organización no accede al estado de entrega');
select is((select count(*)::integer from public.invitee_contacts), 0,
  'RLS oculta los contactos a otra organización');

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000009', true);
select lives_ok(format('select public.move_event_to_trash(%L::uuid)',
  (select event_id from editor_state)), 'mover a papelera funciona');
select is(jsonb_array_length(public.get_trashed_events()), 1, 'la papelera lista el evento retirado');
select is(public.get_public_invitation((select token from editor_state)), null,
  'mover a papelera bloquea el enlace público');
select lives_ok(format('select public.restore_trashed_event(%L::uuid)',
  (select event_id from editor_state)), 'el evento se puede restaurar');
select is((select count(*)::integer from public.events
  where id = (select event_id from editor_state)), 1, 'restaurar devuelve el evento a la lista activa');
select is(public.get_public_invitation((select token from editor_state)), null,
  'restaurar no reactiva enlaces revocados');

select lives_ok(format('select public.move_event_to_trash(%L::uuid)',
  (select event_id from editor_state)), 'el evento restaurado puede volver a papelera');
reset role;
update public.events
set deleted_at = now() - interval '31 days', purge_after = now() - interval '1 day'
where id = (select event_id from editor_state);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000009', true);
select throws_ok(format('select public.purge_trashed_event(%L::uuid)',
  (select event_id from editor_state)), '42501', 'No autorizado',
  'sólo el propietario puede purgar definitivamente');

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000009', true);
select lives_ok(format('select public.purge_trashed_event(%L::uuid)',
  (select event_id from editor_state)), 'el propietario puede purgar después de la retención');
select ok(exists(select 1 from public.audit_log where action = 'event.purged'
  and metadata ->> 'pii_removed' = 'true'), 'la purga conserva auditoría mínima sin PII');

reset role;
select * from finish();
rollback;
