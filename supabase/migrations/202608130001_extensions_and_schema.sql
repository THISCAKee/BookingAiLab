create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.customer_profiles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete restrict,
  university_email text unique not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_email_normalized check (
    university_email = lower(trim(university_email))
  ),
  constraint customer_profiles_email_domain check (
    university_email ~ '^[^@[:space:]]+@msu[.]ac[.]th$'
  ),
  constraint customer_profiles_display_name_not_blank check (
    length(trim(display_name)) > 0
  )
);

create table public.admin_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_profiles_role_valid check (
    role in ('admin', 'super_admin')
  )
);

create table public.machines (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  machine_code text unique not null,
  machine_name text not null,
  location text,
  device_token_hash text not null,
  status text not null default 'inactive',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machines_code_normalized check (
    machine_code = upper(trim(machine_code))
    and length(machine_code) > 0
  ),
  constraint machines_name_not_blank check (
    length(trim(machine_name)) > 0
  ),
  constraint machines_token_hash_not_blank check (
    length(trim(device_token_hash)) > 0
  ),
  constraint machines_status_valid check (
    status in ('inactive', 'available', 'maintenance', 'disabled')
  )
);

create table public.bookings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_number text unique not null,
  customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  machine_id uuid not null references public.machines(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_number_not_blank check (
    length(trim(booking_number)) > 0
  ),
  constraint bookings_time_valid check (
    start_at < end_at
  ),
  constraint bookings_status_valid check (
    status in (
      'confirmed',
      'app_pending',
      'app_received',
      'active',
      'completed',
      'cancelled',
      'expired'
    )
  )
);

create table public.app_credentials (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id) on delete restrict,
  username text unique not null,
  password_hash text not null,
  password_encrypted text not null,
  expires_at timestamptz not null,
  first_login_at timestamptz,
  created_at timestamptz not null default now(),
  constraint app_credentials_username_not_blank check (
    length(trim(username)) > 0
  ),
  constraint app_credentials_hash_not_blank check (
    length(trim(password_hash)) > 0
  ),
  constraint app_credentials_encrypted_not_blank check (
    length(trim(password_encrypted)) > 0
  ),
  constraint app_credentials_first_login_valid check (
    first_login_at is null or first_login_at >= created_at
  )
);

create table public.machine_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint machine_events_type_not_blank check (
    length(trim(event_type)) > 0
  ),
  constraint machine_events_payload_object check (
    jsonb_typeof(payload) = 'object'
  ),
  constraint machine_events_status_valid check (
    status in ('pending', 'delivered', 'processed', 'failed')
  )
);

create table public.notifications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  recipient_type text not null,
  recipient text not null,
  notification_type text not null,
  status text not null default 'pending',
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notifications_recipient_type_valid check (
    recipient_type in ('customer', 'admin')
  ),
  constraint notifications_recipient_not_blank check (
    length(trim(recipient)) > 0
  ),
  constraint notifications_type_not_blank check (
    length(trim(notification_type)) > 0
  ),
  constraint notifications_status_valid check (
    status in ('pending', 'sent', 'failed', 'retrying')
  ),
  constraint notifications_attempt_count_valid check (
    attempt_count >= 0
  ),
  constraint notifications_sent_at_valid check (
    status <> 'sent' or sent_at is not null
  )
);

create table public.audit_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (
    length(trim(action)) > 0
  ),
  constraint audit_logs_entity_type_not_blank check (
    length(trim(entity_type)) > 0
  ),
  constraint audit_logs_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row execute function public.set_updated_at();

create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

create trigger machines_set_updated_at
before update on public.machines
for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();
