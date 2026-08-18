begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_function(
  'public',
  'ensure_customer_profile',
  array['text']::text[],
  'customer profile bootstrap function exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.customer_profiles'::regclass),
  true,
  'customer_profiles keeps RLS enabled'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '14000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'profile.one@msu.ac.th', '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  ),
  (
    '14000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'profile.two@msu.ac.th', '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  ),
  (
    '14000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'outside@example.com', '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  );

insert into public.customer_profiles (
  id, auth_user_id, university_email, display_name
) values (
  '24000000-0000-0000-0000-000000000002',
  '14000000-0000-0000-0000-000000000002',
  'profile.two@msu.ac.th',
  'Profile Two'
);

insert into public.machines (
  id, machine_code, machine_name, device_token_hash, status
) values
  (
    '34000000-0000-0000-0000-000000000001',
    'PC-PROFILE-001', 'Booked maintenance PC', 'profile-hash-001', 'maintenance'
  ),
  (
    '34000000-0000-0000-0000-000000000002',
    'PC-PROFILE-002', 'Unbooked maintenance PC', 'profile-hash-002', 'maintenance'
  ),
  (
    '34000000-0000-0000-0000-000000000003',
    'PC-PROFILE-003', 'Available PC', 'profile-hash-003', 'available'
  );

insert into public.bookings (
  booking_number, customer_id, machine_id, start_at, end_at, status
) values (
  'BK-PROFILE-001',
  '24000000-0000-0000-0000-000000000002',
  '34000000-0000-0000-0000-000000000001',
  now(), now() + interval '3 hours', 'confirmed'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$select public.ensure_customer_profile('Profile One')$$,
  'authenticated customer can bootstrap own profile'
);
select is(
  (
    select count(*)::integer
    from public.customer_profiles
    where auth_user_id = '14000000-0000-0000-0000-000000000001'
  ),
  1,
  'only one own customer profile is created'
);

select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-0000-0000-000000000002',
  true
);

select results_eq(
  $$select count(*)::bigint from public.machines where machine_code like 'PC-PROFILE-%'$$,
  array[2::bigint],
  'customer sees available and own booked machines only'
);
select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-0000-0000-000000000003',
  true
);
select throws_ok(
  $$select public.ensure_customer_profile('Outside User')$$,
  'P0001',
  'CUSTOMER_EMAIL_NOT_ALLOWED',
  'non-university email cannot bootstrap a customer profile'
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
