create table public.machine_presence (
  machine_id uuid primary key references public.machines(id) on delete cascade,
  session_status text not null default 'logged_out',
  username text,
  reported_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  app_version text not null,
  os_version text not null,
  updated_at timestamptz not null default now(),
  constraint machine_presence_status_valid check (
    session_status in ('logged_in', 'logged_out', 'idle')
  ),
  constraint machine_presence_username_valid check (
    session_status = 'logged_out' or username is not null
  ),
  constraint machine_presence_app_version_not_blank check (length(trim(app_version)) > 0),
  constraint machine_presence_os_version_not_blank check (length(trim(os_version)) > 0)
);

create index machine_presence_status_idx
on public.machine_presence (session_status, last_seen_at desc);

create trigger machine_presence_set_updated_at
before update on public.machine_presence
for each row execute function public.set_updated_at();

alter table public.machine_presence enable row level security;

grant select on table public.machine_presence to authenticated;

create policy active_admin_read_machine_presence
on public.machine_presence
for select
to authenticated
using ((select private.is_active_admin()));

create or replace function public.record_machine_heartbeat(
  p_machine_code text,
  p_device_token text,
  p_username text,
  p_session_status text,
  p_app_version text,
  p_os_version text,
  p_reported_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_machine public.machines%rowtype;
  v_machine_id uuid;
  v_username text;
begin
  if length(trim(coalesce(p_machine_code, ''))) = 0
     or length(trim(coalesce(p_device_token, ''))) = 0
     or length(trim(coalesce(p_app_version, ''))) = 0
     or length(trim(coalesce(p_os_version, ''))) = 0
     or p_reported_at is null
     or p_session_status is null
     or p_session_status not in ('logged_in', 'logged_out', 'idle') then
    raise exception using errcode = 'P0001', message = 'INVALID_HEARTBEAT';
  end if;

  select *
  into v_machine
  from public.machines
  where machine_code = upper(trim(p_machine_code))
    and device_token_hash = encode(extensions.digest(trim(p_device_token), 'sha256'), 'hex')
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MACHINE_TOKEN_INVALID';
  end if;

  v_username := nullif(trim(coalesce(p_username, '')), '');
  if p_session_status <> 'logged_out' and v_username is null then
    raise exception using errcode = 'P0001', message = 'USERNAME_REQUIRED';
  end if;

  update public.machines
  set last_seen_at = now(), updated_at = now()
  where id = v_machine.id;

  insert into public.machine_presence (
    machine_id,
    session_status,
    username,
    reported_at,
    last_seen_at,
    app_version,
    os_version
  ) values (
    v_machine.id,
    p_session_status,
    case when p_session_status = 'logged_out' then null else v_username end,
    p_reported_at,
    now(),
    trim(p_app_version),
    trim(p_os_version)
  )
  on conflict (machine_id) do update set
    session_status = excluded.session_status,
    username = excluded.username,
    reported_at = excluded.reported_at,
    last_seen_at = excluded.last_seen_at,
    app_version = excluded.app_version,
    os_version = excluded.os_version,
    updated_at = now();

  return jsonb_build_object(
    'machineId', v_machine.id,
    'machineCode', v_machine.machine_code,
    'receivedAt', now()
  );
end;
$$;

revoke all on function public.record_machine_heartbeat(text, text, text, text, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.record_machine_heartbeat(text, text, text, text, text, text, timestamptz)
to anon, authenticated;
