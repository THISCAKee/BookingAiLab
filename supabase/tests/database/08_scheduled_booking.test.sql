begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_column('public', 'bookings', 'manage_token_hash', 'bookings stores a management token hash');
select hasnt_column('public', 'admin_profiles', 'role', 'single-admin profiles do not carry roles');
select has_function(
  'public',
  'get_booking_options',
  array['date']::text[],
  'public booking options RPC exists'
);
select has_function(
  'public',
  'create_scheduled_booking',
  array['text', 'uuid', 'timestamptz']::text[],
  'scheduled booking RPC exists'
);
select has_function(
  'public',
  'get_booking_by_code',
  array['text', 'text']::text[],
  'booking lookup RPC exists'
);
select has_function(
  'public',
  'cancel_booking_by_code',
  array['text', 'text']::text[],
  'public cancellation RPC exists'
);
select has_function(
  'public',
  'admin_cancel_booking',
  array['uuid']::text[],
  'admin cancellation RPC exists'
);
select is(
  (select count(*)::integer from public.machines where machine_code ~ '^PC-00[1-6]$'),
  6,
  'six lab machines are seeded'
);
select is(
  (select count(*)::integer from public.machines where machine_code ~ '^PC-00[1-6]$' and status = 'available'),
  6,
  'all six seeded machines are available'
);
select is(
  (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'machines' and column_name = 'device_token_hash'),
  'YES',
  'machines may remain unprovisioned'
);
select is(
  has_function_privilege('anon', 'public.get_booking_options(date)', 'EXECUTE'),
  true,
  'anonymous visitors can load booking options'
);
select is(
  has_function_privilege('anon', 'public.create_scheduled_booking(text,uuid,timestamptz)', 'EXECUTE'),
  true,
  'anonymous visitors can create scheduled bookings'
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
