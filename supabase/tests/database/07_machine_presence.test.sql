begin;
select plan(8);

select has_table('public', 'machine_presence', 'machine_presence exists');
select has_column('public', 'machine_presence', 'machine_id', 'machine_presence.machine_id exists');
select has_column('public', 'machine_presence', 'session_status', 'machine_presence.session_status exists');
select has_column('public', 'machine_presence', 'username', 'machine_presence.username exists');
select has_function(
  'public',
  'record_machine_heartbeat',
  array['text', 'text', 'text', 'text', 'text', 'text', 'timestamptz']::text[],
  'heartbeat RPC exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.machine_presence'::regclass),
  true,
  'machine_presence has RLS'
);
select is(
  has_function_privilege(
    'anon',
    'public.record_machine_heartbeat(text,text,text,text,text,text,timestamptz)',
    'EXECUTE'
  ),
  true,
  'heartbeat RPC is callable by device clients'
);
select is(
  (select count(*) = 1
   from pg_index i
   join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
   where i.indrelid = 'public.machine_presence'::regclass
     and i.indisprimary
     and a.attname = 'machine_id'),
  true,
  'one presence row per machine'
);

select * from finish();
rollback;
