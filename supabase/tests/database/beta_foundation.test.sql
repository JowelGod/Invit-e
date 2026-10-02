begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
  (
    '50000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'beta-owner@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Beta Owner"}', now(), now()
  ),
  (
    '60000000-0000-4000-8000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'outsider@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Outsider"}', now(), now()
  ),
  (
    '61000000-0000-4000-8000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'planner@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Planner"}', now(), now()
  ),
  (
    '62000000-0000-4000-8000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'viewer@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Viewer"}', now(), now()
  );

insert into public.organization_members(organization_id, user_id, role)
select profile.default_organization_id, membership.user_id, membership.role
from public.profiles profile
cross join (
  values
    ('61000000-0000-4000-8000-000000000006'::uuid, 'planner'::public.app_role),
    ('62000000-0000-4000-8000-000000000006'::uuid, 'viewer'::public.app_role)
) membership(user_id, role)
where profile.id = '50000000-0000-4000-8000-000000000005';

create temp table beta_state (
  event_id uuid,
  party_id uuid,
  schedule_id uuid,
  token text,
  named_id uuid,
  plus_one_id uuid
);
insert into beta_state default values;
grant all on beta_state to authenticated;
grant select on beta_state to anon;

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update beta_state set event_id = public.create_event(
  'Evento beta', '2027-11-20T18:00:00-06:00', 5, 'Jardín', 'America/Mexico_City'
);

update beta_state set party_id = public.create_guest_party_v2(
  event_id,
  'Familia Rivera',
  'Marta Rivera',
  'marta@example.test',
  '+52 55 0000 0000',
  3,
  '[
    {
      "client_key":"71000000-0000-4000-8000-000000000007",
      "display_name":"Marta Rivera",
      "invitee_type":"named_guest"
    },
    {
      "client_key":"72000000-0000-4000-8000-000000000007",
      "display_name":null,
      "invitee_type":"plus_one",
      "companion_of_key":"71000000-0000-4000-8000-000000000007",
      "companion_label":"Acompañante de Marta"
    }
  ]'::jsonb
);

update beta_state set schedule_id = public.create_schedule_item(
  event_id, 'Ceremonia', 'Llegar quince minutos antes',
  '2027-11-20T18:00:00-06:00', '2027-11-20T19:00:00-06:00',
  'Templo', 'Calle de prueba', null, null, null
);
update beta_state set token = public.create_invitation_link(party_id);
update beta_state set
  named_id = (
    select id from public.invitees
    where guest_party_id = party_id and public_key = '71000000-0000-4000-8000-000000000007'
  ),
  plus_one_id = (
    select id from public.invitees
    where guest_party_id = party_id and public_key = '72000000-0000-4000-8000-000000000007'
  );

select is(
  (select count(*)::integer from public.event_schedule_items), 1,
  'el propietario consulta la agenda de su evento'
);
select is(
  (select assigned_capacity from public.guest_parties where id = (select party_id from beta_state)),
  3,
  'el grupo conserva su capacidad asignada'
);
select is(
  (select count(*)::integer from public.invitees where guest_party_id = (select party_id from beta_state)),
  3,
  'cada lugar asignado es una fila, incluido el lugar sin nombre'
);
select is(
  (
    select companion_of_invitee_id from public.invitees
    where id = (select plus_one_id from beta_state)
  ),
  (select named_id from beta_state),
  'el acompañante se vincula a una persona nominal del mismo grupo'
);
select is(
  jsonb_array_length(
    public.get_public_invitation((select token from beta_state)) -> 'event' -> 'schedule'
  ),
  1,
  'la invitación pública incluye la agenda ordenada'
);
select is(
  jsonb_array_length(public.get_public_invitation((select token from beta_state)) -> 'places'),
  3,
  'la invitación pública devuelve sólo los lugares activos del grupo'
);
select is(
  (public.event_capacity_summary((select event_id from beta_state)) ->> 'assigned')::integer,
  3,
  'los lugares asignados se derivan de filas activas'
);
select is(
  (public.event_capacity_summary((select event_id from beta_state)) ->> 'response_percentage')::numeric,
  0::numeric,
  'el porcentaje de respuesta inicia en cero'
);

select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000006', true);
select is(
  (select count(*)::integer from public.events), 1,
  'viewer puede leer los eventos de su organización'
);
select throws_ok(
  format(
    'select public.change_event_status(%L::uuid, %L::public.event_status)',
    (select event_id from beta_state), 'published'
  ),
  '42501', 'No autorizado',
  'viewer no puede mutar el evento'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000006', true);
select is(
  (select count(*)::integer from public.event_schedule_items), 1,
  'planner puede leer la agenda de su organización'
);
select lives_ok(
  format(
    'select public.update_event_details(%L::uuid,%L,%L::timestamptz,5,%L,%L)',
    (select event_id from beta_state), 'Evento beta', '2027-11-20T18:00:00-06:00',
    'Jardín', 'America/Mexico_City'
  ),
  'planner puede editar datos operativos'
);

select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000006', true);
select is(
  (select count(*)::integer from public.event_schedule_items), 0,
  'otra organización no puede consultar la agenda'
);
select is(
  (select count(*)::integer from public.guest_parties), 0,
  'otra organización no puede consultar los contactos del grupo'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select ok(
  not has_table_privilege('anon', 'public.event_schedule_items', 'select'),
  'el invitado público no puede enumerar actividades'
);
select ok(
  not (
    public.get_public_invitation((select token from beta_state))::text
    ~* '(contact_email|contact_phone|primary_contact_name|guest_party_id|invitee_id)'
  ),
  'la respuesta pública no expone contactos ni IDs internos'
);
select is(
  public.get_public_invitation(repeat('f', 64)), null,
  'un token inexistente no devuelve información'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  format(
    'select public.change_event_template(%L::uuid, %L)',
    (select event_id from beta_state), 'other-template'
  ),
  '55000',
  'La plantilla queda bloqueada al publicar o generar invitaciones',
  'un enlace activo bloquea el cambio de plantilla'
);
select lives_ok(
  format(
    'select public.respond_to_invitation(%L, %L::jsonb, %L::uuid)',
    (select token from beta_state),
    '[{"invitee_key":"72000000-0000-4000-8000-000000000007","status":"rejected"}]',
    '73000000-0000-4000-8000-000000000007'
  ),
  'el acompañante puede rechazar su lugar'
);
select is(
  (
    public.event_capacity_summary((select event_id from beta_state))
    ->> 'available_to_reassign'
  )::integer,
  3,
  'un rechazo libera capacidad sin borrar el lugar'
);
select lives_ok(
  format(
    'select public.update_guest_party(%L::uuid,%L,%L,%L,%L,2)',
    (select party_id from beta_state), 'Familia Rivera', 'Marta Rivera',
    'marta@example.test', '+52 55 0000 0000'
  ),
  'reducir cupo retira primero un lugar pendiente sin historial'
);
select is(
  (
    select count(*)::integer from public.invitees
    where guest_party_id = (select party_id from beta_state) and retired_at is null
  ),
  2,
  'el retiro es lógico y deja dos lugares activos'
);
select throws_ok(
  format(
    'select public.update_guest_party(%L::uuid,%L,%L,%L,%L,1)',
    (select party_id from beta_state), 'Familia Rivera', 'Marta Rivera',
    'marta@example.test', '+52 55 0000 0000'
  ),
  '23514',
  'No se pueden retirar lugares respondidos, con historial o con acompañantes activos',
  'no se retira un lugar respondido ni su persona principal'
);
select lives_ok(
  format(
    'select public.change_event_status(%L::uuid, %L::public.event_status)',
    (select event_id from beta_state), 'archived'
  ),
  'el evento se puede archivar'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select is(
  public.get_public_invitation((select token from beta_state)), null,
  'archivar oculta la invitación pública sin borrar el enlace'
);
select is(
  public.respond_to_invitation(
    (select token from beta_state),
    '[{"invitee_key":"71000000-0000-4000-8000-000000000007","status":"confirmed"}]'::jsonb,
    '74000000-0000-4000-8000-000000000007'
  ),
  null,
  'archivar impide nuevas respuestas RSVP'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  format(
    'select public.update_event_details(%L::uuid,%L,%L::timestamptz,5,%L,%L)',
    (select event_id from beta_state), 'Evento beta', '2027-11-20T18:00:00-06:00',
    'Jardín', 'America/Mexico_City'
  ),
  '55000',
  'El evento está archivado',
  'el archivado es terminal para las operaciones administrativas'
);

reset role;
select * from finish();
rollback;
