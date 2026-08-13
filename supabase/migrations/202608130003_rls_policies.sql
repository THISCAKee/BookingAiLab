create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where auth_user_id = (select auth.uid())
      and is_active = true
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where auth_user_id = (select auth.uid())
      and is_active = true
      and role = 'super_admin'
  );
$$;

revoke all on function private.is_active_admin() from public;
revoke all on function private.is_super_admin() from public;
grant execute on function private.is_active_admin() to authenticated;
grant execute on function private.is_super_admin() to authenticated;

alter table public.customer_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.machines enable row level security;
alter table public.bookings enable row level security;
alter table public.app_credentials enable row level security;
alter table public.machine_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.customer_profiles from anon;
revoke all on table public.admin_profiles from anon;
revoke all on table public.machines from anon;
revoke all on table public.bookings from anon;
revoke all on table public.app_credentials from anon;
revoke all on table public.machine_events from anon;
revoke all on table public.notifications from anon;
revoke all on table public.audit_logs from anon;

grant select, insert, update, delete on table public.customer_profiles to authenticated;
grant select, insert, update, delete on table public.admin_profiles to authenticated;
grant select, insert, update, delete on table public.machines to authenticated;
grant select, insert, update, delete on table public.bookings to authenticated;
grant select, insert, update, delete on table public.app_credentials to authenticated;
grant select, insert, update, delete on table public.machine_events to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;
grant select on table public.audit_logs to authenticated;

create policy customer_read_own_profile
on public.customer_profiles
for select
to authenticated
using ((select auth.uid()) = auth_user_id);

create policy customer_read_available_machines
on public.machines
for select
to authenticated
using (status = 'available');

create policy customer_read_own_bookings
on public.bookings
for select
to authenticated
using (
  customer_id in (
    select id
    from public.customer_profiles
    where auth_user_id = (select auth.uid())
  )
);

create policy customer_read_own_notifications
on public.notifications
for select
to authenticated
using (
  recipient_type = 'customer'
  and booking_id in (
    select b.id
    from public.bookings b
    join public.customer_profiles c on c.id = b.customer_id
    where c.auth_user_id = (select auth.uid())
  )
);

create policy active_admin_manage_customer_profiles
on public.customer_profiles
for all
to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_machines
on public.machines
for all
to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_bookings
on public.bookings
for all
to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_app_credentials
on public.app_credentials
for all
to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_machine_events
on public.machine_events
for all
to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_notifications
on public.notifications
for all
to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_read_admin_profiles
on public.admin_profiles
for select
to authenticated
using ((select private.is_active_admin()));

create policy super_admin_insert_admin_profiles
on public.admin_profiles
for insert
to authenticated
with check ((select private.is_super_admin()));

create policy super_admin_update_admin_profiles
on public.admin_profiles
for update
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

create policy super_admin_delete_admin_profiles
on public.admin_profiles
for delete
to authenticated
using ((select private.is_super_admin()));

create policy active_admin_read_audit_logs
on public.audit_logs
for select
to authenticated
using ((select private.is_active_admin()));
