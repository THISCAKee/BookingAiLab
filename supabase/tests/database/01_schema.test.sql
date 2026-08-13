begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table('public', 'customer_profiles', 'customer_profiles exists');
select has_table('public', 'admin_profiles', 'admin_profiles exists');
select has_table('public', 'machines', 'machines exists');
select has_table('public', 'bookings', 'bookings exists');
select has_table('public', 'app_credentials', 'app_credentials exists');
select has_table('public', 'machine_events', 'machine_events exists');
select has_table('public', 'notifications', 'notifications exists');
select has_table('public', 'audit_logs', 'audit_logs exists');
select has_column('public', 'bookings', 'start_at', 'bookings.start_at exists');
select col_type_is(
  'public',
  'bookings',
  'start_at',
  'timestamp with time zone',
  'start_at is timestamptz'
);
select has_function(
  'public',
  'set_updated_at',
  array[]::text[],
  'updated_at trigger function exists'
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
