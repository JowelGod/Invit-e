begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) values
  (
    '81000000-0000-4000-8000-000000000008',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ux-owner@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"UX Owner"}', now(), now()
  ),
  (
    '82000000-0000-4000-8000-000000000008',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ux-outsider@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    now(), '{"full_name":"UX Outsider"}', now(), now()
  );

create temp table ux_state(event_id uuid, party_id uuid, token text);
insert into ux_state default values;
grant all on ux_state to authenticated;
grant select on ux_state to anon;

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update ux_state set event_id = public.create_event(
  'Evento UX', now() + interval '30 days', 6, 'Jardín', 'America/Mexico_City'
);

with saved as (
  select public.save_guest_party_v3(
    (select event_id from ux_state), null, 'Familia UX',
    '[
      {"key":"83000000-0000-4000-8000-000000000008","display_name":"Maya","invitee_type":"named_guest"},
      {"key":"84000000-0000-4000-8000-000000000008","display_name":"Acompañante de Maya","invitee_type":"plus_one","companion_of_key":"83000000-0000-4000-8000-000000000008"},
      {"key":"85000000-0000-4000-8000-000000000008","display_name":"Ivanna","invitee_type":"named_guest"}
    ]'::jsonb,
    '[
      {"kind":"email","value":"MAYA@EXAMPLE.TEST"},
      {"kind":"phone","value":"+52 55 0000 0000"}
    ]'::jsonb
  ) result
)
update ux_state set
  party_id = (saved.result ->> 'party_id')::uuid,
  token = saved.result ->> 'token'
from saved;

select is(
  (select assigned_capacity from public.guest_parties where id = (select party_id from ux_state)),
  3, 'la capacidad se deriva de las personas activas'
);
select is(
  (select count(*)::integer from public.party_delivery_recipients),
  2, 'los destinatarios se guardan por separado'
);
select is(
  (select value from public.party_delivery_recipients where kind = 'email'),
  'maya@example.test', 'el correo se normaliza'
);
select ok(
  (select token from ux_state) ~ '^[a-f0-9]{64}$',
  'crear el grupo genera automáticamente un enlace seguro'
);
select is(
  public.get_public_invitation((select token from ux_state))
    -> 'places' -> 0 ->> 'name',
  'Maya', 'el enlace público muestra el nombre guardado'
);

select lives_ok(
  format(
    'select public.save_guest_party_v3(%L::uuid,%L::uuid,%L,%L::jsonb,%L::jsonb)',
    (select event_id from ux_state), (select party_id from ux_state), 'Familia UX',
    '[
      {"key":"83000000-0000-4000-8000-000000000008","display_name":"Maya Actualizada","invitee_type":"named_guest"},
      {"key":"84000000-0000-4000-8000-000000000008","display_name":"Acompañante de Maya","invitee_type":"plus_one","companion_of_key":"83000000-0000-4000-8000-000000000008"},
      {"key":"85000000-0000-4000-8000-000000000008","display_name":"Ivanna","invitee_type":"named_guest"}
    ]',
    '[{"kind":"email","value":"ivanna@example.test"}]'
  ), 'el grupo completo se guarda en una transacción'
);
select is(
  (select display_name from public.invitees
    where public_key = '83000000-0000-4000-8000-000000000008'),
  'Maya Actualizada', 'editar un nombre persiste en la fila'
);
select is(
  public.get_public_invitation((select token from ux_state))
    -> 'places' -> 0 ->> 'name',
  'Maya Actualizada', 'el mismo enlace refleja el nombre actualizado'
);
select ok(
  not (
    public.get_public_invitation((select token from ux_state))::text
      ~* '(delivery|recipient|example.test|contact_email|contact_phone)'
  ), 'la invitación pública no expone destinatarios'
);
select is(
  jsonb_array_length(public.get_event_delivery_state((select event_id from ux_state))),
  1, 'la administración recibe el estado de entrega'
);

select throws_ok(
  format(
    'select public.save_guest_party_v3(%L::uuid,%L::uuid,%L,%L::jsonb,%L::jsonb)',
    (select event_id from ux_state), (select party_id from ux_state), 'Familia UX',
    '[{"key":"85000000-0000-4000-8000-000000000008","display_name":"Ivanna","invitee_type":"named_guest"}]',
    '[]'
  ),
  '23514', 'No se pueden eliminar invitados con respuesta o historial',
  'un invitado con historial no se elimina'
);

select throws_ok(
  format(
    'select public.create_event(%L, now() - interval ''1 day'', 10, null, %L)',
    'Evento pasado', 'America/Mexico_City'
  ),
  '22023', 'La fecha del evento debe ser actual o futura',
  'no se crea un evento en el pasado'
);

select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000008', true);
select throws_ok(
  format('select public.get_event_delivery_state(%L::uuid)', (select event_id from ux_state)),
  '42501', 'No autorizado', 'otra organización no accede a destinatarios'
);
select is((select count(*)::integer from public.party_delivery_recipients), 0,
  'RLS oculta destinatarios a otra organización');

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
select lives_ok(
  format('select public.reset_guest_party_responses(%L::uuid)', (select party_id from ux_state)),
  'el organizador puede reiniciar respuestas'
);
select ok(
  exists (select 1 from public.audit_log where action = 'rsvp.reset'),
  'reiniciar respuestas queda auditado'
);
select throws_ok(
  format('select public.delete_draft_event(%L::uuid)', (select event_id from ux_state)),
  '23514', 'Este evento conserva enlaces o historial y debe archivarse',
  'un evento con enlace no se elimina'
);
select is(
  (select count(*)::integer from public.invitation_links
    where guest_party_id = (select party_id from ux_state) and revoked_at is null),
  1, 'guardar cambios no regenera ni revoca el enlace'
);

reset role;
select * from finish();
rollback;
