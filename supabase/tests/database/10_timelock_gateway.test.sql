begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'timelock_accounts', 'TimeLock account cache exists');
select has_table('public', 'timelock_sessions', 'TimeLock sessions exist');
select has_table('public', 'timelock_login_locks', 'login lock state exists');
select has_table('public', 'timelock_sheet_outbox', 'Sheet outbox exists');
select has_table('public', 'timelock_sync_state', 'Sheet sync state exists');
select has_column('public', 'timelock_accounts', 'machine_id', 'account is machine-bound');
select has_column('public', 'timelock_accounts', 'password_hash', 'only verifier hash is persisted');
select has_column('public', 'timelock_accounts', 'source_row', 'Sheet source row is persisted');
select has_column('public', 'timelock_sessions', 'client_session_id', 'offline session idempotency key exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.timelock_accounts'::regclass),
  true,
  'account cache has RLS'
);
select ok(
  exists (
    select 1 from pg_index
    where indrelid = 'public.timelock_sessions'::regclass
      and indisunique
      and pg_get_expr(indpred, indrelid) like '%status%active%'
  ),
  'one active session per account is enforced'
);
select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'timelock_accounts' and column_name = 'password'),
  0::bigint,
  'plaintext password column does not exist'
);

select * from finish();
rollback;
