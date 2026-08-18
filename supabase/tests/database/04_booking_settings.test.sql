begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table(
  'public',
  'booking_settings',
  'booking_settings table exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.booking_settings'::regclass),
  true,
  'booking_settings has RLS enabled'
);
select is(
  (select service_weekdays::text from public.booking_settings limit 1),
  '{1,2,3,4,5}',
  'default service weekdays are Monday through Friday'
);
select is(
  (select opening_time::text from public.booking_settings limit 1),
  '08:30:00',
  'default opening time is 08:30'
);
select is(
  (select closing_time::text from public.booking_settings limit 1),
  '16:30:00',
  'default closing time is 16:30'
);
select is(
  (select duration_minutes from public.booking_settings limit 1),
  180,
  'default duration is three hours'
);
select is(
  (select grace_minutes from public.booking_settings limit 1),
  15,
  'default no-show grace is fifteen minutes'
);
select is(
  (select timezone from public.booking_settings limit 1),
  'Asia/Bangkok',
  'default timezone is Bangkok'
);

update public.admin_profiles set is_active = false;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '12000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'settings.admin@msu.ac.th', '',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}', '{}'
  );

insert into public.admin_profiles (auth_user_id, is_active) values
  ('12000000-0000-0000-0000-000000000001', true);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '12000000-0000-0000-0000-000000000001',
  true
);

select results_eq(
  $$select count(*)::bigint from public.booking_settings$$,
  array[1::bigint],
  'active admin can read booking settings'
);
select lives_ok(
  $$update public.booking_settings set duration_minutes = 120$$,
  'the active admin can update booking settings'
);
select is(
  (select duration_minutes from public.booking_settings limit 1),
  120,
  'the settings update is persisted'
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
