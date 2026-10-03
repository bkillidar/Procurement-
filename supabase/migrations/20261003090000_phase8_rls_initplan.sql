-- Evaluate auth.uid() once per query instead of once per row.
alter policy profiles_select on public.profiles
  using (id = (select auth.uid()) or id in (select user_id from public.org_members where organization_id in (select public.current_org_ids())));
alter policy profiles_update on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy notifications_select on public.notifications
  using (user_id = (select auth.uid()));
alter policy notifications_update on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy notifications_insert on public.notifications
  with check (user_id = (select auth.uid()) and organization_id in (select public.current_org_ids()));
