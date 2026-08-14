begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '13000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'workflow.one@msu.ac.th', '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'workflow.two@msu.ac.th', '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  );

insert into public.customer_profiles (
  id, auth_user_id, university_email, display_name
) values
  (
    '23000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    'workflow.one@msu.ac.th', 'Workflow One'
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000002',
    'workflow.two@msu.ac.th', 'Workflow Two'
  );

insert into public.machines (
  id, machine_code, machine_name, device_token_hash, status
) values
  (
    '33000000-0000-0000-0000-000000000001',
    'PC-WORKFLOW-001', 'Workflow PC 001', 'workflow-hash-001', 'available'
  ),
  (
    '33000000-0000-0000-0000-000000000002',
    'PC-WORKFLOW-002', 'Workflow PC 002', 'workflow-hash-002', 'available'
  ),
  (
    '33000000-0000-0000-0000-000000000003',
    'PC-WORKFLOW-003', 'Workflow PC 003', 'workflow-hash-003', 'maintenance'
  );

update public.booking_settings
set service_weekdays = array[1, 2, 3, 4, 5, 6, 7],
    opening_time = time '00:00',
    closing_time = time '23:59:59',
    duration_minutes = 180,
    grace_minutes = 15;

insert into public.bookings (
  id, booking_number, customer_id, machine_id, start_at, end_at, status
) values (
  '43000000-0000-0000-0000-000000000001',
  'BK-WORKFLOW-STALE',
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000002',
  now() - interval '20 minutes',
  now() + interval '160 minutes',
  'confirmed'
);

select is(
  (select count(*)::integer from public.machine_events),
  0,
  'no machine event exists before booking'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$select public.create_immediate_booking('33000000-0000-0000-0000-000000000001')$$,
  'customer can create an immediate booking'
);
select is(
  (select count(*)::integer from public.bookings),
  2,
  'new booking is added while stale booking is expired'
);
select is(
  (
    select extract(epoch from (end_at - start_at))::integer
    from public.bookings
    limit 1
  ),
  10800,
  'booking duration is exactly three hours'
);
select is(
  (
    select status
    from public.bookings
    where booking_number = 'BK-WORKFLOW-STALE'
  ),
  'expired',
  'stale no-show booking is expired before new booking'
);

select throws_ok(
  $$select public.create_immediate_booking('33000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'BOOKING_ALREADY_ACTIVE',
  'customer cannot create a second outstanding booking'
);

select lives_ok(
  $$select public.cancel_booking((select id from public.bookings where machine_id = '33000000-0000-0000-0000-000000000001' and status = 'confirmed' limit 1))$$,
  'customer can cancel their booking'
);
select is(
  (select status from public.bookings where machine_id = '33000000-0000-0000-0000-000000000001' order by created_at desc limit 1),
  'cancelled',
  'cancelled booking is terminal'
);

select lives_ok(
  $$select public.create_immediate_booking('33000000-0000-0000-0000-000000000002')$$,
  'customer can book again after cancellation'
);

select lives_ok(
  $$select public.expire_no_show_bookings()$$,
  'expiration workflow is safe when no stale booking remains'
);
select is(
  (
    select count(*)::integer
    from public.bookings
    where status = 'confirmed'
  ),
  1,
  'only the current booking remains confirmed'
);

select throws_ok(
  $$select public.create_immediate_booking('33000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'MACHINE_UNAVAILABLE',
  'unavailable machine cannot be booked'
);

do $$
declare
  diagnostics text;
begin
  select string_agg(line, E'\n') into diagnostics
  from finish() as line;

  if diagnostics is not null then
    raise exception using message = diagnostics;
  end if;
end;
$$;
rollback;
