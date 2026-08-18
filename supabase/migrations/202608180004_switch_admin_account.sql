do $$
declare
  v_new_admin_id uuid;
  v_old_admin_id uuid;
  v_old_booking_count integer;
  v_old_storage_count integer;
begin
  select id into v_new_admin_id
  from auth.users
  where lower(trim(email)) = 'admin@msu.ac.th'
    and email_confirmed_at is not null
    and length(coalesce(encrypted_password, '')) > 0
  limit 1;

  if v_new_admin_id is null then
    raise notice 'admin@msu.ac.th is not present with a confirmed password; skipping account switch';
    return;
  end if;

  select auth_user_id into v_old_admin_id
  from public.admin_profiles
  where is_active = true
    and auth_user_id <> v_new_admin_id
  limit 1
  for update;

  if v_old_admin_id is not null then
    select count(*) into v_old_booking_count
    from public.bookings booking
    join public.customer_profiles customer on customer.id = booking.customer_id
    where customer.auth_user_id = v_old_admin_id;

    select count(*) into v_old_storage_count
    from storage.objects object
    where object.owner_id = v_old_admin_id::text;

    if v_old_booking_count > 0 then
      raise exception 'OLD_ADMIN_HAS_BOOKINGS';
    end if;
    if v_old_storage_count > 0 then
      raise exception 'OLD_ADMIN_HAS_STORAGE_OBJECTS';
    end if;

    update public.admin_profiles
    set is_active = false, updated_at = now()
    where auth_user_id = v_old_admin_id;
  end if;

  insert into public.admin_profiles (auth_user_id, is_active)
  values (v_new_admin_id, true)
  on conflict (auth_user_id) do update
  set is_active = true, updated_at = now();

  if v_old_admin_id is not null then
    delete from public.admin_profiles
    where auth_user_id = v_old_admin_id;

    delete from public.customer_profiles
    where auth_user_id = v_old_admin_id;

    delete from auth.users
    where id = v_old_admin_id;
  end if;
end;
$$;
