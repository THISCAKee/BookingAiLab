create or replace function public.ensure_customer_profile(p_display_name text)
returns public.customer_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_email text;
  v_profile public.customer_profiles;
begin
  v_auth_user_id := (select auth.uid());
  if v_auth_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select lower(trim(u.email))
  into v_email
  from auth.users u
  where u.id = v_auth_user_id
    and u.email_confirmed_at is not null
    and (
      u.raw_app_meta_data ->> 'provider' = 'google'
      or u.raw_app_meta_data -> 'providers' ? 'google'
    );

  if v_email is null then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_AUTH_NOT_ALLOWED';
  end if;

  if v_email !~ '^[^@[:space:]]+@msu[.]ac[.]th$' then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_EMAIL_NOT_ALLOWED';
  end if;

  insert into public.customer_profiles (
    auth_user_id,
    university_email,
    display_name
  ) values (
    v_auth_user_id,
    v_email,
    coalesce(nullif(trim(p_display_name), ''), split_part(v_email, '@', 1))
  )
  on conflict (auth_user_id) do update
  set university_email = excluded.university_email,
      display_name = excluded.display_name,
      updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.ensure_customer_profile(text) from public, anon;
grant execute on function public.ensure_customer_profile(text) to authenticated;

create policy customer_read_own_booked_machines
on public.machines
for select
to authenticated
using (
  id in (
    select b.machine_id
    from public.bookings b
    join public.customer_profiles c on c.id = b.customer_id
    where c.auth_user_id = (select auth.uid())
  )
);
