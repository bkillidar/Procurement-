-- Only emails on this list can ever have an account. Managed with SQL by the owner; no policies on
-- purpose, so the public/browser key cannot read or change it.
create table public.allowed_emails (
  email text primary key,
  role text not null default 'owner' check (role in ('owner','admin','project_manager','member','viewer')),
  created_at timestamptz not null default now(),
  constraint allowed_emails_lowercase check (email = lower(email))
);
alter table public.allowed_emails enable row level security;

-- New accounts always get a profile; allowed emails join the company with their role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  org uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  select id into org from public.organizations order by created_at limit 1;
  if org is null then
    insert into public.organizations (name) values ('My Company') returning id into org;
  end if;

  insert into public.org_members (organization_id, user_id, role)
  select org, new.id, a.role from public.allowed_emails a where a.email = lower(new.email)
  on conflict do nothing;
  return new;
end $$;
