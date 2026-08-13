create table public.booking_settings (
  id integer primary key default 1,
  service_weekdays integer[] not null default array[1, 2, 3, 4, 5],
  opening_time time not null default time '08:30',
  closing_time time not null default time '16:30',
  duration_minutes integer not null default 180,
  grace_minutes integer not null default 15,
  timezone text not null default 'Asia/Bangkok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_settings_singleton check (id = 1),
  constraint booking_settings_weekdays_not_empty check (
    cardinality(service_weekdays) > 0
  ),
  constraint booking_settings_weekdays_valid check (
    service_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]
  ),
  constraint booking_settings_closing_after_opening check (
    closing_time > opening_time
  ),
  constraint booking_settings_duration_positive check (
    duration_minutes > 0
  ),
  constraint booking_settings_grace_non_negative check (
    grace_minutes >= 0
  ),
  constraint booking_settings_timezone_not_blank check (
    length(trim(timezone)) > 0
  )
);

insert into public.booking_settings (
  id,
  service_weekdays,
  opening_time,
  closing_time,
  duration_minutes,
  grace_minutes,
  timezone
) values (
  1,
  array[1, 2, 3, 4, 5],
  time '08:30',
  time '16:30',
  180,
  15,
  'Asia/Bangkok'
);

create trigger booking_settings_set_updated_at
before update on public.booking_settings
for each row execute function public.set_updated_at();

alter table public.booking_settings enable row level security;

revoke all on table public.booking_settings from anon;
grant select, update on table public.booking_settings to authenticated;

create policy active_admin_read_booking_settings
on public.booking_settings
for select
to authenticated
using ((select private.is_active_admin()));

create policy super_admin_update_booking_settings
on public.booking_settings
for update
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));
