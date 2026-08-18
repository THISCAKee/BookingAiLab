begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'one@msu.ac.th',
    '',
    now(),
    now(),
    now(),
    '{"provider":"google","providers":["google"]}',
    '{}'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'two@msu.ac.th',
    '',
    now(),
    now(),
    now(),
    '{"provider":"google","providers":["google"]}',
    '{}'
  );

insert into public.customer_profiles (
  id,
  auth_user_id,
  university_email,
  display_name
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'one@msu.ac.th',
    'User One'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'two@msu.ac.th',
    'User Two'
  );

insert into public.machines (
  id,
  machine_code,
  machine_name,
  device_token_hash,
  status
) values
  (
    '30000000-0000-0000-0000-000000000001',
    'PC-CONSTRAINT-001',
    'Constraint PC 001',
    'hash-001',
    'available'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'PC-CONSTRAINT-002',
    'Constraint PC 002',
    'hash-002',
    'available'
  );

insert into public.bookings (
  id,
  booking_number,
  customer_id,
  machine_id,
  start_at,
  end_at,
  status
) values (
  '40000000-0000-0000-0000-000000000001',
  'BK-BASE',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '2026-08-20 10:00:00+07',
  '2026-08-20 12:00:00+07',
  'confirmed'
);

select throws_ok(
  $$
    insert into public.bookings (
      booking_number, customer_id, machine_id, start_at, end_at
    ) values (
      'BK-BAD-TIME',
      '20000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000002',
      '2026-08-20 12:00:00+07',
      '2026-08-20 11:00:00+07'
    )
  $$,
  '23514',
  null,
  'end_at must be after start_at'
);

select throws_ok(
  $$
    insert into public.bookings (
      booking_number, customer_id, machine_id, start_at, end_at
    ) values (
      'BK-MACHINE-OVERLAP',
      '20000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000001',
      '2026-08-20 11:00:00+07',
      '2026-08-20 13:00:00+07'
    )
  $$,
  '23P01',
  null,
  'same machine cannot overlap'
);

select throws_ok(
  $$
    insert into public.bookings (
      booking_number, customer_id, machine_id, start_at, end_at
    ) values (
      'BK-CUSTOMER-OVERLAP',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002',
      '2026-08-20 11:00:00+07',
      '2026-08-20 13:00:00+07'
    )
  $$,
  '23P01',
  null,
  'same customer cannot overlap'
);

select lives_ok(
  $$
    insert into public.bookings (
      booking_number, customer_id, machine_id, start_at, end_at
    ) values (
      'BK-ADJACENT',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      '2026-08-20 12:00:00+07',
      '2026-08-20 13:00:00+07'
    )
  $$,
  'adjacent booking is allowed'
);

update public.bookings
set status = 'cancelled'
where booking_number = 'BK-BASE';

select lives_ok(
  $$
    insert into public.bookings (
      booking_number, customer_id, machine_id, start_at, end_at
    ) values (
      'BK-AFTER-CANCEL',
      '20000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000001',
      '2026-08-20 10:00:00+07',
      '2026-08-20 12:00:00+07'
    )
  $$,
  'cancelled booking releases the slot'
);

update public.bookings
set status = 'expired'
where booking_number = 'BK-AFTER-CANCEL';

select lives_ok(
  $$
    insert into public.bookings (
      booking_number, customer_id, machine_id, start_at, end_at
    ) values (
      'BK-AFTER-EXPIRE',
      '20000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000001',
      '2026-08-20 10:00:00+07',
      '2026-08-20 12:00:00+07'
    )
  $$,
  'expired booking releases the slot'
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
