alter table public.bookings
  add constraint bookings_machine_time_no_overlap
  exclude using gist (
    machine_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status not in ('cancelled', 'expired'));

alter table public.bookings
  add constraint bookings_customer_time_no_overlap
  exclude using gist (
    customer_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status not in ('cancelled', 'expired'));

create index bookings_customer_start_idx
on public.bookings (customer_id, start_at desc);

create index bookings_machine_start_idx
on public.bookings (machine_id, start_at desc);

create index bookings_status_start_idx
on public.bookings (status, start_at);

create index machine_events_machine_status_created_idx
on public.machine_events (machine_id, status, created_at);

create index machine_events_booking_idx
on public.machine_events (booking_id);

create index notifications_status_created_idx
on public.notifications (status, created_at);

create index notifications_booking_idx
on public.notifications (booking_id);

create index machines_status_code_idx
on public.machines (status, machine_code);

create index audit_logs_entity_created_idx
on public.audit_logs (entity_type, entity_id, created_at desc);
