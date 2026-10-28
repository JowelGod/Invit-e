-- Existing rows are preserved. Only new writes that exceed the limit are rejected.
create or replace function public.enforce_invitee_phone_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'phone' then
    perform 1 from public.invitees where id = new.invitee_id for update;
    if (select count(*) from public.invitee_contacts
        where invitee_id = new.invitee_id and kind = 'phone' and id <> new.id) >= 2 then
      raise exception 'Cada invitado admite como máximo dos teléfonos' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger invitee_contacts_phone_limit
before insert or update of invitee_id, kind on public.invitee_contacts
for each row execute function public.enforce_invitee_phone_limit();
