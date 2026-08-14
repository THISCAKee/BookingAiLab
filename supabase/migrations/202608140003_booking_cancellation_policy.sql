create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select b.status
  into v_status
  from public.bookings b
  join public.customer_profiles c on c.id = b.customer_id
  where b.id = p_booking_id
    and c.auth_user_id = (select auth.uid())
  for update of b;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  if v_status in ('completed', 'cancelled', 'expired', 'active') then
    raise exception using errcode = 'P0001', message = 'BOOKING_CANCELLATION_NOT_ALLOWED';
  end if;

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = p_booking_id;
end;
$$;
