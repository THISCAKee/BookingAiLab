create or replace function private.generate_device_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

create or replace function public.rotate_machine_device_token(p_machine_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_machine public.machines%rowtype;
  v_device_token text;
begin
  if not (select private.is_active_admin()) then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  select * into v_machine
  from public.machines
  where id = p_machine_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MACHINE_NOT_FOUND';
  end if;

  v_device_token := private.generate_device_token();

  update public.machines
  set device_token_hash = encode(extensions.digest(v_device_token, 'sha256'), 'hex'),
      updated_at = now()
  where id = v_machine.id;

  insert into public.audit_logs (
    actor_auth_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    (select auth.uid()),
    'machine.device_token_rotated',
    'machine',
    v_machine.id,
    jsonb_build_object('machineCode', v_machine.machine_code)
  );

  return jsonb_build_object(
    'machineId', v_machine.id,
    'machineCode', v_machine.machine_code,
    'deviceToken', v_device_token
  );
end;
$$;

revoke all on function public.rotate_machine_device_token(uuid) from public, anon, authenticated;
grant execute on function public.rotate_machine_device_token(uuid) to authenticated;
