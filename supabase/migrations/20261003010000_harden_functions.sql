-- handle_new_user() is only meant to run as the auth.users trigger,
-- never via the public REST API (/rest/v1/rpc/handle_new_user).
revoke all on function public.handle_new_user() from public, anon, authenticated;
alter function public.set_updated_at() set search_path = '';
