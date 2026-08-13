-- Reconcile a partially-created BookingAiLab schema before the canonical
-- Phase 3 migrations are applied. This intentionally leaves Supabase-managed
-- schemas such as auth and storage untouched.

drop schema if exists private cascade;

drop table if exists public.notifications cascade;
drop table if exists public.machine_events cascade;
drop table if exists public.app_credentials cascade;
drop table if exists public.bookings cascade;
drop table if exists public.machines cascade;
drop table if exists public.admin_profiles cascade;
drop table if exists public.customer_profiles cascade;
drop table if exists public.audit_logs cascade;

drop function if exists public.set_updated_at();
