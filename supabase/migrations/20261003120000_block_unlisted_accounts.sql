-- Reject account creation for any email that is not on the allowlist (even if sign-ups are on).
create or replace function public.enforce_allowed_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null or not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'This email is not allowed to create an account';
  end if;
  return new;
end $$;
revoke all on function public.enforce_allowed_email() from public, anon, authenticated;
create trigger enforce_allowed_email before insert on auth.users
  for each row execute function public.enforce_allowed_email();
