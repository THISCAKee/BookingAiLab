begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_function(
  'public',
  'rotate_machine_device_token',
  array['uuid']::text[],
  'machine token rotation RPC exists'
);
select is(
  has_function_privilege('authenticated', 'public.rotate_machine_device_token(uuid)', 'EXECUTE'),
  true,
  'authenticated admins can call token rotation RPC'
);
select is(
  has_function_privilege('anon', 'public.rotate_machine_device_token(uuid)', 'EXECUTE'),
  false,
  'anonymous users cannot rotate device tokens'
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
