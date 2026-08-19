create table public.timelock_accounts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  sheet_user_id text unique not null,
  username text unique not null,
  machine_id uuid not null references public.machines(id) on delete restrict,
  password_algorithm text not null default 'pbkdf2-sha256',
  password_iterations integer not null,
  password_salt text not null,
  password_hash text not null,
  password_fingerprint text not null,
  allowed_minutes integer not null,
  is_active boolean not null default false,
  source_row integer not null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timelock_accounts_username_normalized check (username = lower(trim(username)) and length(username) > 0),
  constraint timelock_accounts_verifier_valid check (
    password_algorithm = 'pbkdf2-sha256'
    and password_iterations > 0
    and length(password_salt) > 0
    and length(password_hash) > 0
    and length(password_fingerprint) > 0
  ),
  constraint timelock_accounts_minutes_valid check (allowed_minutes > 0),
  constraint timelock_accounts_source_row_valid check (source_row >= 2)
);

create table public.timelock_sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  account_id uuid not null references public.timelock_accounts(id) on delete restrict,
  machine_id uuid not null references public.machines(id) on delete restrict,
  client_session_id text unique not null,
  source text not null default 'online',
  status text not null default 'active',
  started_at timestamptz not null,
  ended_at timestamptz,
  used_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timelock_sessions_client_id_not_blank check (length(trim(client_session_id)) > 0),
  constraint timelock_sessions_source_valid check (source in ('online', 'offline')),
  constraint timelock_sessions_status_valid check (status in ('active', 'logged_out', 'completed', 'forced_logout')),
  constraint timelock_sessions_used_seconds_valid check (used_seconds >= 0),
  constraint timelock_sessions_end_valid check (
    (status = 'active' and ended_at is null)
    or (status <> 'active' and ended_at is not null and ended_at >= started_at)
  )
);

create unique index timelock_sessions_one_active_account_idx
on public.timelock_sessions (account_id)
where status = 'active';

create index timelock_sessions_machine_started_idx
on public.timelock_sessions (machine_id, started_at desc);

create table public.timelock_login_locks (
  account_id uuid primary key references public.timelock_accounts(id) on delete cascade,
  failed_count integer not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint timelock_login_locks_count_valid check (failed_count between 0 and 5)
);

create table public.timelock_sheet_outbox (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  account_id uuid not null references public.timelock_accounts(id) on delete cascade,
  source_row integer not null,
  desired_active boolean not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint timelock_sheet_outbox_status_valid check (status in ('pending', 'processing', 'completed')),
  constraint timelock_sheet_outbox_attempt_valid check (attempt_count >= 0),
  constraint timelock_sheet_outbox_source_row_valid check (source_row >= 2)
);

create unique index timelock_sheet_outbox_pending_account_idx
on public.timelock_sheet_outbox (account_id, desired_active)
where status <> 'completed';

create table public.timelock_sync_state (
  singleton boolean primary key default true,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  synced_row_count integer not null default 0,
  pending_outbox_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint timelock_sync_state_singleton check (singleton),
  constraint timelock_sync_counts_valid check (synced_row_count >= 0 and pending_outbox_count >= 0)
);

insert into public.timelock_sync_state (singleton) values (true);

create trigger timelock_accounts_set_updated_at
before update on public.timelock_accounts
for each row execute function public.set_updated_at();

create trigger timelock_sessions_set_updated_at
before update on public.timelock_sessions
for each row execute function public.set_updated_at();

create trigger timelock_login_locks_set_updated_at
before update on public.timelock_login_locks
for each row execute function public.set_updated_at();

alter table public.timelock_accounts enable row level security;
alter table public.timelock_sessions enable row level security;
alter table public.timelock_login_locks enable row level security;
alter table public.timelock_sheet_outbox enable row level security;
alter table public.timelock_sync_state enable row level security;

create policy active_admin_read_timelock_accounts
on public.timelock_accounts for select to authenticated
using ((select private.is_active_admin()));

create policy active_admin_read_timelock_sessions
on public.timelock_sessions for select to authenticated
using ((select private.is_active_admin()));

create policy active_admin_read_timelock_sync_state
on public.timelock_sync_state for select to authenticated
using ((select private.is_active_admin()));

create policy active_admin_read_timelock_outbox
on public.timelock_sheet_outbox for select to authenticated
using ((select private.is_active_admin()));

create or replace function public.start_timelock_session(
  p_account_id uuid,
  p_machine_id uuid,
  p_client_session_id text,
  p_source text,
  p_started_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.timelock_accounts%rowtype;
  v_session_id uuid;
begin
  select * into v_account
  from public.timelock_accounts
  where id = p_account_id
  for update;

  if not found or not v_account.is_active then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_INACTIVE';
  end if;
  if v_account.machine_id <> p_machine_id then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_MACHINE_MISMATCH';
  end if;
  if p_source not in ('online', 'offline') or length(trim(coalesce(p_client_session_id, ''))) = 0 then
    raise exception using errcode = 'P0001', message = 'SESSION_INVALID';
  end if;

  insert into public.timelock_sessions (
    account_id, machine_id, client_session_id, source, status, started_at
  ) values (
    v_account.id, p_machine_id, trim(p_client_session_id), p_source, 'active', coalesce(p_started_at, now())
  )
  returning id into v_session_id;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'username', v_account.username,
    'allowedMinutes', v_account.allowed_minutes,
    'startedAt', coalesce(p_started_at, now())
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_ACTIVE';
end;
$$;

create or replace function public.end_timelock_session(
  p_session_id uuid,
  p_machine_id uuid,
  p_used_seconds integer,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.timelock_sessions%rowtype;
  v_source_row integer;
begin
  if p_status not in ('logged_out', 'completed', 'forced_logout') or p_used_seconds < 0 then
    raise exception using errcode = 'P0001', message = 'LOGOUT_INVALID';
  end if;

  select * into v_session
  from public.timelock_sessions
  where id = p_session_id and machine_id = p_machine_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_FOUND';
  end if;

  if v_session.status = 'active' then
    update public.timelock_sessions
    set status = p_status, ended_at = now(), used_seconds = p_used_seconds
    where id = v_session.id;

    update public.timelock_accounts
    set is_active = false
    where id = v_session.account_id
    returning source_row into v_source_row;

    insert into public.timelock_sheet_outbox (account_id, source_row, desired_active)
    values (v_session.account_id, v_source_row, false)
    on conflict (account_id, desired_active) where status <> 'completed'
    do nothing;
  end if;

  return jsonb_build_object('sessionId', v_session.id, 'status', p_status);
end;
$$;

revoke all on function public.start_timelock_session(uuid, uuid, text, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.end_timelock_session(uuid, uuid, integer, text)
from public, anon, authenticated;
grant execute on function public.start_timelock_session(uuid, uuid, text, text, timestamptz) to service_role;
grant execute on function public.end_timelock_session(uuid, uuid, integer, text) to service_role;
