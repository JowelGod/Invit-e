begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-a@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Owner A"}', now(), now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-b@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"Owner B"}', now(), now()
  );

create temp table test_state (
  event_a uuid,
  party_a uuid,
  first_token text,
  active_token text,
  invitee_key uuid,
  idempotency_key uuid default '30000000-0000-4000-8000-000000000003'
);
insert into test_state default values;
grant all on test_state to authenticated;
grant select on test_state to anon;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update test_state set event_a = public.create_event(
  'Boda de prueba',
  '2027-06-12T18:00:00-06:00',
  4,
  'Jardín de prueba',
  'America/Mexico_City'
);

update test_state set party_a = public.create_guest_party(
  event_a,
  'Familia García',
  '[{"display_name":"Ana García"},{"display_name":null}]'::jsonb
);

update test_state set first_token = public.create_invitation_link(party_a);
update test_state set active_token = public.create_invitation_link(party_a);
update test_state set invitee_key = (
  select public_key from public.invitees where guest_party_id = party_a order by created_at limit 1
);

select is(
  (select count(*)::integer from public.events),
  1,
  'la organización propietaria consulta su evento'
);

select is(
  (select count(*)::integer from public.guest_parties),
  1,
  'la organización propietaria consulta su grupo'
);

select is(
  (public.event_capacity_summary((select event_a from test_state)) ->> 'pending')::integer,
  2,
  'los lugares empiezan pendientes y se derivan de filas'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.events),
  0,
  'otra organización no puede consultar eventos ajenos'
);

select is(
  (select count(*)::integer from public.invitees),
  0,
  'otra organización no puede consultar invitados ajenos'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select ok(
  not has_table_privilege('anon', 'public.events', 'select'),
  'un invitado público no puede enumerar eventos'
);

select is(
  public.get_public_invitation((select active_token from test_state)) -> 'event' ->> 'title',
  'Boda de prueba',
  'un token válido accede a su invitación'
);

select is(
  jsonb_array_length(
    public.get_public_invitation((select active_token from test_state)) -> 'places'
  ),
  2,
  'el token sólo devuelve los lugares de su grupo'
);

select ok(
  not (
    public.get_public_invitation((select active_token from test_state))::text
    ~* '(email|phone|organization_id|guest_party_id|invitee_id)'
  ),
  'la respuesta pública no expone PII ni IDs internos'
);

select is(
  public.get_public_invitation(repeat('0', 64)),
  null,
  'un token inválido no devuelve información'
);

select is(
  public.get_public_invitation((select first_token from test_state)),
  null,
  'un token regenerado revoca el anterior'
);

select throws_ok(
  format(
    'select public.respond_to_invitation(%L, %L::jsonb, %L::uuid)',
    (select active_token from test_state),
    jsonb_build_array(jsonb_build_object(
      'invitee_key', (select invitee_key from test_state),
      'status', 'confirmed',
      'capacity', 999
    ))::text,
    (select idempotency_key from test_state)
  ),
  '22023',
  'La respuesta contiene campos no permitidos',
  'RSVP rechaza campos administrativos'
);

select lives_ok(
  format(
    'select public.respond_to_invitation(%L, %L::jsonb, %L::uuid)',
    (select active_token from test_state),
    jsonb_build_array(jsonb_build_object(
      'invitee_key', (select invitee_key from test_state),
      'status', 'rejected'
    ))::text,
    (select idempotency_key from test_state)
  ),
  'una respuesta RSVP permitida se procesa'
);

select lives_ok(
  format(
    'select public.respond_to_invitation(%L, %L::jsonb, %L::uuid)',
    (select active_token from test_state),
    jsonb_build_array(jsonb_build_object(
      'invitee_key', (select invitee_key from test_state),
      'status', 'rejected'
    ))::text,
    (select idempotency_key from test_state)
  ),
  'repetir la misma clave de idempotencia es seguro'
);

reset role;
set local role postgres;

select is(
  (select count(*)::integer from public.rsvp_events),
  1,
  'la idempotencia conserva un solo evento append-only'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    public.event_capacity_summary((select event_a from test_state))
    ->> 'available_to_reassign'
  )::integer,
  3,
  'un rechazo libera capacidad para reasignar'
);

select lives_ok(
  format(
    'select public.create_guest_party(%L::uuid, %L, %L::jsonb)',
    (select event_a from test_state),
    'Grupo reasignado',
    '[{"display_name":"Nuevo 1"},{"display_name":"Nuevo 2"},{"display_name":"Nuevo 3"}]'
  ),
  'la capacidad liberada puede reasignarse sin reciclar la fila rechazada'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  format(
    'select public.respond_to_invitation(%L, %L::jsonb, %L::uuid)',
    (select active_token from test_state),
    jsonb_build_array(jsonb_build_object(
      'invitee_key', (select invitee_key from test_state),
      'status', 'confirmed'
    ))::text,
    '40000000-0000-4000-8000-000000000004'
  ),
  '23514',
  'El lugar ya fue reasignado y el evento no tiene capacidad disponible',
  'una reconfirmación tardía no puede producir sobrecupo'
);

reset role;
select * from finish();
rollback;
