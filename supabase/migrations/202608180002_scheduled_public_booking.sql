alter table public.bookings
add column manage_token_hash text;

alter table public.machines
alter column device_token_hash drop not null;

alter table public.machines
drop constraint machines_token_hash_not_blank;

alter table public.machines
add constraint machines_token_hash_valid check (
  device_token_hash is null or length(trim(device_token_hash)) > 0
);

drop policy if exists super_admin_insert_admin_profiles on public.admin_profiles;
drop policy if exists super_admin_update_admin_profiles on public.admin_profiles;
drop policy if exists super_admin_delete_admin_profiles on public.admin_profiles;
drop policy if exists super_admin_update_booking_settings on public.booking_settings;

drop function if exists private.is_super_admin();

update public.admin_profiles
set role = 'admin', updated_at = now()
where is_active = true;

alter table public.admin_profiles
drop constraint admin_profiles_role_valid;

alter table public.admin_profiles
drop column role;

create unique index admin_profiles_single_active_idx
on public.admin_profiles ((is_active))
where is_active = true;

create policy active_admin_update_booking_settings
on public.booking_settings
for update
to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

insert into public.machines (
  machine_code,
  machine_name,
  location,
  device_token_hash,
  status
)
select
  'PC-' || lpad(machine_number::text, 3, '0'),
  'เครื่องคอมพิวเตอร์ ' || machine_number,
  'AI Lab',
  null,
  'available'
from generate_series(1, 6) as machine_number
on conflict (machine_code) do nothing;

create or replace function private.normalize_booking_identity(p_identity text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_identity text;
begin
  v_identity := lower(trim(coalesce(p_identity, '')));
  if v_identity ~ '^[0-9]+$' then
    return v_identity || '@msu.ac.th';
  end if;
  if v_identity ~ '^[^@[:space:]]+@msu[.]ac[.]th$' then
    return v_identity;
  end if;
  return null;
end;
$$;

create or replace function private.generate_manage_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v_code text := '';
  v_index integer;
begin
  for v_index in 0..11 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_index) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function public.get_booking_options(p_booking_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_today date;
  v_slot_count integer;
  v_slots jsonb;
begin
  select * into strict v_settings
  from public.booking_settings
  where id = 1;

  if v_settings.timezone <> 'Asia/Bangkok' then
    raise exception using errcode = 'P0001', message = 'BOOKING_TIMEZONE_UNSUPPORTED';
  end if;

  v_today := (now() at time zone v_settings.timezone)::date;
  if p_booking_date not in (v_today, v_today + 1) then
    raise exception using errcode = 'P0001', message = 'BOOKING_DATE_NOT_ALLOWED';
  end if;

  if not (extract(isodow from p_booking_date)::integer = any(v_settings.service_weekdays)) then
    return jsonb_build_object('date', p_booking_date, 'slots', '[]'::jsonb);
  end if;

  v_slot_count := floor(
    extract(epoch from (v_settings.closing_time - v_settings.opening_time))
      / 60 / v_settings.duration_minutes
  )::integer;

  with slots as (
    select
      (
        p_booking_date + v_settings.opening_time
        + (slot_number * v_settings.duration_minutes * interval '1 minute')
      ) at time zone v_settings.timezone as start_at,
      (
        p_booking_date + v_settings.opening_time
        + ((slot_number + 1) * v_settings.duration_minutes * interval '1 minute')
      ) at time zone v_settings.timezone as end_at
    from generate_series(0, greatest(v_slot_count - 1, -1)) as slot_number
    where v_slot_count > 0
  ), available_slots as (
    select * from slots where start_at > now()
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'startAt', slot.start_at,
        'endAt', slot.end_at,
        'label', to_char(slot.start_at at time zone v_settings.timezone, 'HH24:MI')
          || '–' || to_char(slot.end_at at time zone v_settings.timezone, 'HH24:MI'),
        'machines', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', machine.id,
                'machineCode', machine.machine_code,
                'machineName', machine.machine_name,
                'location', machine.location,
                'available', machine.status = 'available'
                  and not exists (
                    select 1
                    from public.bookings booking
                    where booking.machine_id = machine.id
                      and booking.status not in ('cancelled', 'expired')
                      and tstzrange(booking.start_at, booking.end_at, '[)')
                        && tstzrange(slot.start_at, slot.end_at, '[)')
                  )
              ) order by machine.machine_code
            ),
            '[]'::jsonb
          )
          from public.machines machine
          where machine.machine_code ~ '^PC-00[1-6]$'
        )
      ) order by slot.start_at
    ),
    '[]'::jsonb
  ) into v_slots
  from available_slots slot;

  return jsonb_build_object('date', p_booking_date, 'slots', v_slots);
end;
$$;

create or replace function public.create_scheduled_booking(
  p_identity text,
  p_machine_id uuid,
  p_start_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_auth_user auth.users%rowtype;
  v_profile public.customer_profiles%rowtype;
  v_machine public.machines%rowtype;
  v_settings public.booking_settings%rowtype;
  v_local_start timestamp;
  v_expected_end timestamptz;
  v_today date;
  v_opening_minutes integer;
  v_start_minutes integer;
  v_slot_offset integer;
  v_booking_id uuid;
  v_booking_number text;
  v_manage_code text;
begin
  v_email := private.normalize_booking_identity(p_identity);
  if v_email is null or p_machine_id is null or p_start_at is null then
    raise exception using errcode = 'P0001', message = 'BOOKING_REQUEST_NOT_ALLOWED';
  end if;

  select * into v_auth_user
  from auth.users auth_user
  where lower(trim(auth_user.email)) = v_email
    and auth_user.email_confirmed_at is not null
    and (
      auth_user.raw_app_meta_data ->> 'provider' = 'google'
      or auth_user.raw_app_meta_data -> 'providers' ? 'google'
    )
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_REQUEST_NOT_ALLOWED';
  end if;

  select * into strict v_settings
  from public.booking_settings
  where id = 1;

  if v_settings.timezone <> 'Asia/Bangkok' then
    raise exception using errcode = 'P0001', message = 'BOOKING_TIMEZONE_UNSUPPORTED';
  end if;

  v_local_start := p_start_at at time zone v_settings.timezone;
  v_today := (now() at time zone v_settings.timezone)::date;
  if v_local_start::date not in (v_today, v_today + 1)
     or p_start_at <= now()
     or not (extract(isodow from v_local_start)::integer = any(v_settings.service_weekdays)) then
    raise exception using errcode = 'P0001', message = 'BOOKING_REQUEST_NOT_ALLOWED';
  end if;

  v_opening_minutes := extract(hour from v_settings.opening_time)::integer * 60
    + extract(minute from v_settings.opening_time)::integer;
  v_start_minutes := extract(hour from v_local_start)::integer * 60
    + extract(minute from v_local_start)::integer;
  v_slot_offset := v_start_minutes - v_opening_minutes;
  v_expected_end := p_start_at + (v_settings.duration_minutes * interval '1 minute');

  if extract(second from v_local_start) <> 0
     or v_slot_offset < 0
     or v_slot_offset % v_settings.duration_minutes <> 0
     or (v_expected_end at time zone v_settings.timezone)::date <> v_local_start::date
     or (v_expected_end at time zone v_settings.timezone)::time > v_settings.closing_time then
    raise exception using errcode = 'P0001', message = 'BOOKING_REQUEST_NOT_ALLOWED';
  end if;

  select * into v_machine
  from public.machines machine
  where machine.id = p_machine_id
    and machine.status = 'available'
    and machine.machine_code ~ '^PC-00[1-6]$'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MACHINE_UNAVAILABLE';
  end if;

  insert into public.customer_profiles (
    auth_user_id,
    university_email,
    display_name
  ) values (
    v_auth_user.id,
    v_email,
    coalesce(
      nullif(trim(v_auth_user.raw_user_meta_data ->> 'full_name'), ''),
      split_part(v_email, '@', 1)
    )
  )
  on conflict (auth_user_id) do update
  set university_email = excluded.university_email,
      display_name = excluded.display_name,
      updated_at = now()
  returning * into v_profile;

  update public.bookings
  set status = 'expired', updated_at = now()
  where customer_id = v_profile.id
    and status in ('confirmed', 'app_pending')
    and end_at <= now();

  update public.bookings
  set status = 'completed', updated_at = now()
  where customer_id = v_profile.id
    and status in ('app_received', 'active')
    and end_at <= now();

  if exists (
    select 1 from public.bookings booking
    where booking.customer_id = v_profile.id
      and booking.status not in ('completed', 'cancelled', 'expired')
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_ALREADY_ACTIVE';
  end if;

  v_booking_number := 'BK-'
    || to_char(v_local_start, 'YYYYMMDD') || '-'
    || upper(substring(pg_catalog.gen_random_uuid()::text, 1, 8));
  v_manage_code := private.generate_manage_code();

  begin
    insert into public.bookings (
      booking_number,
      customer_id,
      machine_id,
      start_at,
      end_at,
      status,
      manage_token_hash
    ) values (
      v_booking_number,
      v_profile.id,
      v_machine.id,
      p_start_at,
      v_expected_end,
      'confirmed',
      encode(extensions.digest(v_manage_code, 'sha256'), 'hex')
    )
    returning id into v_booking_id;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'BOOKING_CONFLICT';
  end;

  insert into public.machine_events (
    machine_id,
    booking_id,
    event_type,
    payload,
    status
  ) values (
    v_machine.id,
    v_booking_id,
    'booking_confirmed',
    jsonb_build_object(
      'bookingId', v_booking_id,
      'bookingNumber', v_booking_number,
      'machineCode', v_machine.machine_code,
      'startAt', p_start_at,
      'endAt', v_expected_end
    ),
    'pending'
  );

  return jsonb_build_object(
    'bookingId', v_booking_id,
    'bookingNumber', v_booking_number,
    'manageCode', v_manage_code,
    'machineCode', v_machine.machine_code,
    'startAt', p_start_at,
    'endAt', v_expected_end,
    'status', 'confirmed'
  );
end;
$$;

create or replace function public.get_booking_by_code(
  p_booking_number text,
  p_manage_code text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'bookingId', booking.id,
    'bookingNumber', booking.booking_number,
    'machineCode', machine.machine_code,
    'machineName', machine.machine_name,
    'location', machine.location,
    'startAt', booking.start_at,
    'endAt', booking.end_at,
    'status', booking.status,
    'canCancel', booking.status in ('confirmed', 'app_pending', 'app_received')
      and booking.start_at > now()
  )
  from public.bookings booking
  join public.machines machine on machine.id = booking.machine_id
  where booking.booking_number = upper(trim(p_booking_number))
    and booking.manage_token_hash = encode(
      extensions.digest(upper(trim(p_manage_code)), 'sha256'),
      'hex'
    );
$$;

create or replace function public.cancel_booking_by_code(
  p_booking_number text,
  p_manage_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking
  from public.bookings booking
  where booking.booking_number = upper(trim(p_booking_number))
    and booking.manage_token_hash = encode(
      extensions.digest(upper(trim(p_manage_code)), 'sha256'),
      'hex'
    )
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_ACCESS_DENIED';
  end if;

  if v_booking.status not in ('confirmed', 'app_pending', 'app_received')
     or v_booking.start_at <= now() then
    raise exception using errcode = 'P0001', message = 'BOOKING_CANCELLATION_NOT_ALLOWED';
  end if;

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = v_booking.id;
end;
$$;

create or replace function public.admin_cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not (select private.is_active_admin()) then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  select status into v_status
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;
  if v_status in ('completed', 'cancelled', 'expired') then
    raise exception using errcode = 'P0001', message = 'BOOKING_CANCELLATION_NOT_ALLOWED';
  end if;

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = p_booking_id;

  insert into public.audit_logs (
    actor_auth_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    (select auth.uid()),
    'booking.cancelled_by_admin',
    'booking',
    p_booking_id,
    jsonb_build_object('previousStatus', v_status)
  );
end;
$$;

revoke all on function public.get_booking_options(date) from public, anon, authenticated;
revoke all on function public.create_scheduled_booking(text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.get_booking_by_code(text, text) from public, anon, authenticated;
revoke all on function public.cancel_booking_by_code(text, text) from public, anon, authenticated;
revoke all on function public.admin_cancel_booking(uuid) from public, anon, authenticated;

grant execute on function public.get_booking_options(date) to anon, authenticated;
grant execute on function public.create_scheduled_booking(text, uuid, timestamptz) to anon, authenticated;
grant execute on function public.get_booking_by_code(text, text) to anon, authenticated;
grant execute on function public.cancel_booking_by_code(text, text) to anon, authenticated;
grant execute on function public.admin_cancel_booking(uuid) to authenticated;
