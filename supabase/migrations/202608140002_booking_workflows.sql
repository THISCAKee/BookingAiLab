create or replace function public.expire_no_show_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_expired_count integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select c.id
  into v_customer_id
  from public.customer_profiles c
  where c.auth_user_id = (select auth.uid());

  if v_customer_id is null then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_PROFILE_REQUIRED';
  end if;

  update public.bookings b
  set status = 'expired', updated_at = now()
  where b.customer_id = v_customer_id
    and b.status in ('confirmed', 'app_pending')
    and b.start_at + (
      (
        select s.grace_minutes
        from public.booking_settings s
        where s.id = 1
      ) * interval '1 minute'
    ) <= now();

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

create or replace function public.create_immediate_booking(p_machine_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_customer_id uuid;
  v_machine_code text;
  v_machine_status text;
  v_service_weekdays integer[];
  v_opening_time time;
  v_closing_time time;
  v_duration_minutes integer;
  v_timezone text;
  v_local_now timestamp;
  v_local_end timestamp;
  v_booking_id uuid;
  v_booking_number text;
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  v_auth_user_id := (select auth.uid());
  if v_auth_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  perform public.expire_no_show_bookings();

  select c.id
  into v_customer_id
  from public.customer_profiles c
  where c.auth_user_id = v_auth_user_id;

  if v_customer_id is null then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_PROFILE_REQUIRED';
  end if;

  select
    s.service_weekdays,
    s.opening_time,
    s.closing_time,
    s.duration_minutes,
    s.timezone
  into
    v_service_weekdays,
    v_opening_time,
    v_closing_time,
    v_duration_minutes,
    v_timezone
  from public.booking_settings s
  where s.id = 1;

  v_local_now := now() at time zone v_timezone;
  v_local_end := v_local_now + (v_duration_minutes * interval '1 minute');

  if not (extract(isodow from v_local_now)::integer = any(v_service_weekdays)) then
    raise exception using errcode = 'P0001', message = 'SERVICE_CLOSED';
  end if;

  if v_local_now::time < v_opening_time then
    raise exception using errcode = 'P0001', message = 'SERVICE_NOT_OPEN';
  end if;

  if v_local_end::date <> v_local_now::date
     or v_local_end::time > v_closing_time then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_SERVICE_TIME';
  end if;

  select m.machine_code, m.status
  into v_machine_code, v_machine_status
  from public.machines m
  where m.id = p_machine_id
  for update;

  if not found or v_machine_status <> 'available' then
    raise exception using errcode = 'P0001', message = 'MACHINE_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.customer_id = v_customer_id
      and b.status not in ('completed', 'cancelled', 'expired')
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_ALREADY_ACTIVE';
  end if;

  v_start_at := now();
  v_end_at := v_start_at + (v_duration_minutes * interval '1 minute');

  begin
    insert into public.bookings (
      booking_number,
      customer_id,
      machine_id,
      start_at,
      end_at,
      status
    ) values (
      'BK-' || to_char(v_local_now, 'YYYYMMDDHH24MISS') || '-' ||
        substring(pg_catalog.gen_random_uuid()::text, 1, 8),
      v_customer_id,
      p_machine_id,
      v_start_at,
      v_end_at,
      'confirmed'
    )
    returning id, booking_number
    into v_booking_id, v_booking_number;
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
    p_machine_id,
    v_booking_id,
    'booking_confirmed',
    jsonb_build_object(
      'bookingId', v_booking_id,
      'bookingNumber', v_booking_number,
      'machineCode', v_machine_code,
      'startAt', v_start_at,
      'endAt', v_end_at
    ),
    'pending'
  );

  return jsonb_build_object(
    'bookingId', v_booking_id,
    'bookingNumber', v_booking_number,
    'machineId', p_machine_id,
    'machineCode', v_machine_code,
    'startAt', v_start_at,
    'endAt', v_end_at,
    'status', 'confirmed'
  );
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select b.status
  into v_status
  from public.bookings b
  join public.customer_profiles c on c.id = b.customer_id
  where b.id = p_booking_id
    and c.auth_user_id = (select auth.uid())
  for update of b;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  if v_status in ('completed', 'cancelled', 'expired', 'active') then
    raise exception using errcode = 'P0001', message = 'BOOKING_CANCELLATION_NOT_ALLOWED';
  end if;

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = p_booking_id;
end;
$$;

revoke all on function public.expire_no_show_bookings() from public, anon;
revoke all on function public.create_immediate_booking(uuid) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.expire_no_show_bookings() to authenticated;
grant execute on function public.create_immediate_booking(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
