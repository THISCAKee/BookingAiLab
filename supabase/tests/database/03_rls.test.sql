begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_schema('private', 'private schema exists');
select has_function(
  'private',
  'is_active_admin',
  array[]::text[],
  'active admin helper exists'
);
select hasnt_function(
  'private',
  'is_super_admin',
  array[]::text[],
  'role-based super admin helper was removed'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.customer_profiles'::regclass),
  true,
  'customer_profiles has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.bookings'::regclass),
  true,
  'bookings has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.app_credentials'::regclass),
  true,
  'app_credentials has RLS enabled'
);

update public.admin_profiles set is_active = false;

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
    '11000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'customer.one@msu.ac.th',
    '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'customer.two@msu.ac.th',
    '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@msu.ac.th',
    '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  ),
  (
    '11000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'inactive.admin@msu.ac.th',
    '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  );

insert into public.customer_profiles (
  id,
  auth_user_id,
  university_email,
  display_name
) values
  (
    '21000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'customer.one@msu.ac.th',
    'Customer One'
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'customer.two@msu.ac.th',
    'Customer Two'
  );

insert into public.admin_profiles (auth_user_id, is_active) values
  ('11000000-0000-0000-0000-000000000003', true),
  ('11000000-0000-0000-0000-000000000004', false);

insert into public.machines (
  id,
  machine_code,
  machine_name,
  device_token_hash,
  status
) values
  (
    '31000000-0000-0000-0000-000000000001',
    'PC-RLS-001',
    'Available PC',
    'hash-rls-001',
    'available'
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    'PC-RLS-002',
    'Maintenance PC',
    'hash-rls-002',
    'maintenance'
  );

insert into public.bookings (
  id,
  booking_number,
  customer_id,
  machine_id,
  start_at,
  end_at
) values
  (
    '41000000-0000-0000-0000-000000000001',
    'BK-RLS-001',
    '21000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    '2026-08-21 09:00:00+07',
    '2026-08-21 10:00:00+07'
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    'BK-RLS-002',
    '21000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002',
    '2026-08-21 10:00:00+07',
    '2026-08-21 11:00:00+07'
  );

insert into public.app_credentials (
  booking_id,
  username,
  password_hash,
  password_encrypted,
  expires_at
) values (
  '41000000-0000-0000-0000-000000000001',
  'booking_rls_001',
  'test-hash',
  'test-encrypted',
  '2026-08-21 10:00:00+07'
);

insert into public.notifications (
  booking_id,
  recipient_type,
  recipient,
  notification_type
) values
  (
    '41000000-0000-0000-0000-000000000001',
    'customer',
    'customer.one@msu.ac.th',
    'booking_confirmed'
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    'customer',
    'customer.two@msu.ac.th',
    'booking_confirmed'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-000000000001',
  true
);

select results_eq(
  $$select count(*)::bigint from public.customer_profiles$$,
  array[1::bigint],
  'customer sees only own profile'
);
select results_eq(
  $$select count(*)::bigint from public.bookings$$,
  array[1::bigint],
  'customer sees only own booking'
);
select results_eq(
  $$select count(*)::bigint from public.machines$$,
  array[1::bigint],
  'customer sees only available machines'
);
select results_eq(
  $$select count(*)::bigint from public.notifications$$,
  array[1::bigint],
  'customer sees only own notification'
);
select results_eq(
  $$select count(*)::bigint from public.app_credentials$$,
  array[0::bigint],
  'customer cannot read credentials'
);

select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-000000000003',
  true
);
select results_eq(
  $$select count(*)::bigint from public.customer_profiles$$,
  array[2::bigint],
  'active admin sees all customer profiles'
);
select throws_ok(
  $$
    insert into public.admin_profiles (auth_user_id)
    values ('11000000-0000-0000-0000-000000000002')
  $$,
  '42501',
  null,
  'regular admin cannot grant admin access'
);

select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-000000000004',
  true
);
select results_eq(
  $$select count(*)::bigint from public.customer_profiles$$,
  array[0::bigint],
  'inactive admin receives no admin visibility'
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
