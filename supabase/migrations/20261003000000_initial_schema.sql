-- =====================================================================
-- Initial schema: multi-tenant (organization-scoped) ops & procurement
-- Every business table carries organization_id and is protected by RLS.
-- Enumerations are text + CHECK (easier to extend than Postgres enums).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Tenancy: organizations, profiles, memberships
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- role is text so new roles can be added without a migration of a type.
-- owner/admin: everything. project_manager/member: read+write, no delete.
-- viewer: read-only.
create table public.org_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner','admin','project_manager','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index org_members_user_idx on public.org_members(user_id);

-- ---------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER so they can read org_members
-- without recursing into its own policies).
-- ---------------------------------------------------------------------
create or replace function public.current_org_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select organization_id from public.org_members where user_id = auth.uid()
$$;

create or replace function public.org_role(org uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.org_members
  where organization_id = org and user_id = auth.uid()
$$;

create or replace function public.can_write(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.org_role(org) in ('owner','admin','project_manager','member'), false)
$$;

create or replace function public.can_delete(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.org_role(org) in ('owner','admin'), false)
$$;

revoke all on function public.current_org_ids() from public, anon;
revoke all on function public.org_role(uuid) from public, anon;
revoke all on function public.can_write(uuid) from public, anon;
revoke all on function public.can_delete(uuid) from public, anon;
grant execute on function public.current_org_ids() to authenticated;
grant execute on function public.org_role(uuid) to authenticated;
grant execute on function public.can_write(uuid) to authenticated;
grant execute on function public.can_delete(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- New-user bootstrap: always create a profile. If NO organization exists
-- yet, the very first user becomes owner of a new one (V1 single-company
-- setup). Later users get a profile only; an admin adds them to the org.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  new_org uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  if not exists (select 1 from public.organizations) then
    insert into public.organizations (name) values ('My Company') returning id into new_org;
    insert into public.org_members (organization_id, user_id, role) values (new_org, new.id, 'owner');
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Contacts & vendors
-- Subcontractors, architects, engineers, lenders, utility and municipal
-- contacts are all rows in contacts with a `kind`.
-- ---------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  phone text,
  email text,
  website text,
  typical_lead_time_days integer check (typical_lead_time_days is null or typical_lead_time_days >= 0),
  reliability_notes text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vendors_org_idx on public.vendors(organization_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('vendor','architect','engineer','subcontractor','lender','utility','municipal','other')),
  name text not null,
  company text,
  title text,
  phone text,
  email text,
  vendor_id uuid references public.vendors(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_org_idx on public.contacts(organization_id);
create index contacts_vendor_idx on public.contacts(vendor_id);

-- ---------------------------------------------------------------------
-- Projects, phases, templates
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  jurisdiction text,                       -- e.g. 'DC', 'MD', 'VA' (free text for flexibility)
  project_type text not null default 'renovation'
    check (project_type in ('renovation','new_construction')),
  scope text,
  acquisition_details text,
  start_date date,
  target_completion_date date,
  current_phase_id uuid,                   -- FK added after project_phases exists
  status text not null default 'active'
    check (status in ('planning','active','on_hold','complete','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_org_idx on public.projects(organization_id);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members(user_id);

create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','complete','skipped')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_phases_project_idx on public.project_phases(project_id, position);

alter table public.projects
  add constraint projects_current_phase_fk
  foreign key (current_phase_id) references public.project_phases(id) on delete set null;

create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  project_type text check (project_type in ('renovation','new_construction')),
  jurisdiction text,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.template_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.project_templates(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.template_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.project_templates(id) on delete cascade,
  template_phase_id uuid references public.template_phases(id) on delete cascade,
  key text not null,                       -- stable key used by depends_on_keys
  title text not null,
  description text,
  default_priority text not null default 'medium'
    check (default_priority in ('low','medium','high','urgent')),
  offset_days integer,                     -- days after project start
  depends_on_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, key)
);

-- ---------------------------------------------------------------------
-- Tasks & dependencies
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.project_phases(id) on delete set null,
  title text not null,
  description text,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  status text not null default 'not_started'
    check (status in ('not_started','ready','in_progress','waiting','blocked','complete')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  notes text,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_idx on public.tasks(project_id);
create index tasks_due_idx on public.tasks(organization_id, due_date) where status <> 'complete';
create index tasks_assignee_idx on public.tasks(assignee_id);

-- A task can depend on another task OR on a procurement item reaching a
-- state (e.g. "install windows" depends on windows delivered).
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid references public.tasks(id) on delete cascade,
  depends_on_procurement_item_id uuid,     -- FK added below
  created_at timestamptz not null default now(),
  check (
    (depends_on_task_id is not null)::int + (depends_on_procurement_item_id is not null)::int = 1
  ),
  check (depends_on_task_id is null or depends_on_task_id <> task_id)
);
create index task_dependencies_task_idx on public.task_dependencies(task_id);

-- ---------------------------------------------------------------------
-- Procurement
-- Order details live on the item for V1 (one current order per item).
-- A purchase_orders table can be added later for multi-line POs.
-- ---------------------------------------------------------------------
create table public.procurement_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null,                  -- free text: 'Windows', 'Framing lumber', ...
  description text not null,
  specification text,
  quantity numeric(14,3),
  unit text,
  source_reference text,                   -- architect/engineer sheet or schedule ref
  required_on_site_date date,
  estimated_lead_time_days integer check (estimated_lead_time_days is null or estimated_lead_time_days >= 0),
  target_order_date date,
  actual_order_date date,
  vendor_id uuid references public.vendors(id) on delete set null,
  quote_amount numeric(14,2),
  final_cost numeric(14,2),
  order_number text,
  status text not null default 'needs_specification'
    check (status in ('needs_specification','ready_for_quote','quoting','ready_to_order','ordered',
      'awaiting_vendor_confirmation','confirmed','in_production','shipped','partially_delivered',
      'delivered','problem','complete')),
  vendor_confirmed_at timestamptz,
  vendor_confirmation_notes text,
  expected_delivery_date date,
  actual_delivery_date date,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','partial','delivered','problem')),
  quantity_received numeric(14,3) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index procurement_project_idx on public.procurement_items(project_id);
create index procurement_status_idx on public.procurement_items(organization_id, status);
create index procurement_required_idx on public.procurement_items(organization_id, required_on_site_date);
create index procurement_vendor_idx on public.procurement_items(vendor_id);

alter table public.task_dependencies
  add constraint task_dependencies_item_fk
  foreign key (depends_on_procurement_item_id) references public.procurement_items(id) on delete cascade;

create table public.procurement_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procurement_item_id uuid not null references public.procurement_items(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  amount numeric(14,2),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  availability_notes text,
  quoted_on date,
  valid_until date,
  is_selected boolean not null default false,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index procurement_quotes_item_idx on public.procurement_quotes(procurement_item_id);

-- ---------------------------------------------------------------------
-- Deliveries & issues
-- ---------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procurement_item_id uuid not null references public.procurement_items(id) on delete cascade,
  received_on date not null default current_date,
  quantity_received numeric(14,3),
  is_partial boolean not null default false,
  has_damage boolean not null default false,
  has_missing_items boolean not null default false,
  has_incorrect_items boolean not null default false,
  needs_replacement boolean not null default false,
  notes text,
  received_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deliveries_item_idx on public.deliveries(procurement_item_id);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  issue_type text not null default 'other'
    check (issue_type in ('procurement','vendor','delivery','permit','utility','design','construction','other')),
  title text not null,
  description text,
  severity text not null default 'medium'
    check (severity in ('low','medium','high','critical')),
  owner_id uuid references auth.users(id) on delete set null,
  opened_on date not null default current_date,
  due_date date,
  status text not null default 'open'
    check (status in ('open','in_progress','waiting','resolved','closed')),
  procurement_item_id uuid references public.procurement_items(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  delivery_id uuid references public.deliveries(id) on delete set null,
  resolution text,
  resolved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index issues_project_idx on public.issues(project_id);
create index issues_open_idx on public.issues(organization_id, status) where status in ('open','in_progress','waiting');

-- ---------------------------------------------------------------------
-- Permits & utilities
-- ---------------------------------------------------------------------
create table public.permits_utilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  item_type text not null,                 -- 'Long-form permit', 'Gas cap-off', ...
  agency text,
  submitted_on date,
  status text not null default 'not_started'
    check (status in ('not_started','preparing','submitted','under_review','additional_info_required',
      'approved','scheduled','complete','delayed')),
  contact_id uuid references public.contacts(id) on delete set null,
  reference_number text,
  expected_response_date date,
  last_follow_up_on date,
  next_follow_up_on date,
  approved_on date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index permits_project_idx on public.permits_utilities(project_id);
create index permits_followup_idx on public.permits_utilities(organization_id, next_follow_up_on);

-- ---------------------------------------------------------------------
-- Follow-ups (vendor/agency contact log + next follow-up)
-- Exactly one target is set. Designed so inbound email can create rows later.
-- ---------------------------------------------------------------------
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  procurement_item_id uuid references public.procurement_items(id) on delete cascade,
  permit_id uuid references public.permits_utilities(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  contacted_at timestamptz not null default now(),
  method text not null default 'phone'
    check (method in ('phone','email','text','in_person','portal','other')),
  result text,
  next_follow_up_on date,
  responsible_id uuid references auth.users(id) on delete set null,
  notes text,
  source text not null default 'manual',   -- 'manual' now; 'email' later
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (procurement_item_id is not null)::int + (permit_id is not null)::int + (task_id is not null)::int = 1
  )
);
create index follow_ups_item_idx on public.follow_ups(procurement_item_id);
create index follow_ups_due_idx on public.follow_ups(organization_id, next_follow_up_on);

-- ---------------------------------------------------------------------
-- Documents (metadata; files live in Supabase Storage bucket 'documents')
-- ---------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  category text not null default 'other'
    check (category in ('plan','engineering','contract','quote','purchase_order','invoice','permit','delivery_photo','specification','punch_photo','other')),
  name text not null,
  storage_path text not null unique,       -- '<org_id>/<project_id>/<uuid>-<filename>'
  mime_type text,
  size_bytes bigint,
  procurement_item_id uuid references public.procurement_items(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  permit_id uuid references public.permits_utilities(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete cascade,
  punch_item_id uuid,                      -- FK added below
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_project_idx on public.documents(project_id);

-- ---------------------------------------------------------------------
-- Punch list
-- ---------------------------------------------------------------------
create table public.punch_list_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  location text,                           -- room / area
  description text not null,
  assigned_contact_id uuid references public.contacts(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  due_date date,
  status text not null default 'open'
    check (status in ('open','in_progress','ready_for_verification','verified','wont_fix')),
  notes text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index punch_project_idx on public.punch_list_items(project_id, status);

alter table public.documents
  add constraint documents_punch_fk
  foreign key (punch_item_id) references public.punch_list_items(id) on delete cascade;

-- ---------------------------------------------------------------------
-- Activity log & notifications
-- ---------------------------------------------------------------------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,               -- 'procurement_item', 'task', ...
  entity_id uuid,
  action text not null,                    -- 'order_placed', 'delivery_date_changed', ...
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_project_idx on public.activity_log(project_id, created_at desc);
create index activity_org_idx on public.activity_log(organization_id, created_at desc);

-- Generated by app logic (and later a scheduled job). `channel` lets email/SMS
-- delivery be added without schema changes; V1 uses 'in_app'.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null,                      -- 'task_due','needs_order','follow_up_due',...
  title text not null,
  body text,
  link text,
  channel text not null default 'in_app' check (channel in ('in_app','email','sms')),
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications(user_id, read_at);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_members enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using (id in (select public.current_org_ids()));
create policy organizations_update on public.organizations for update to authenticated
  using (public.can_delete(id)) with check (public.can_delete(id));

-- Profiles: see yourself and people who share an organization with you.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or id in (select user_id from public.org_members where organization_id in (select public.current_org_ids()))
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Memberships: members can see their org's roster; only owner/admin manage it.
create policy org_members_select on public.org_members for select to authenticated
  using (organization_id in (select public.current_org_ids()));
create policy org_members_insert on public.org_members for insert to authenticated
  with check (public.can_delete(organization_id));
create policy org_members_update on public.org_members for update to authenticated
  using (public.can_delete(organization_id)) with check (public.can_delete(organization_id));
create policy org_members_delete on public.org_members for delete to authenticated
  using (public.can_delete(organization_id));

-- Generic org-scoped policies for every business table.
do $$
declare t text;
begin
  foreach t in array array[
    'vendors','contacts','projects','project_members','project_phases','project_templates',
    'template_phases','template_tasks','tasks','task_dependencies','procurement_items',
    'procurement_quotes','deliveries','issues','permits_utilities','follow_ups','documents',
    'punch_list_items','activity_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (organization_id in (select public.current_org_ids()))', t||'_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.can_write(organization_id))', t||'_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.can_write(organization_id)) with check (public.can_write(organization_id))', t||'_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.can_delete(organization_id))', t||'_delete', t);
  end loop;
end $$;

-- Activity log is append-only for users.
drop policy activity_log_update on public.activity_log;
drop policy activity_log_delete on public.activity_log;

-- Notifications: each user sees and updates only their own.
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert to authenticated
  with check (user_id = auth.uid() and organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------
-- Storage: private 'documents' bucket; object path must start with the
-- caller's organization id: '<org_id>/<project_id>/<file>'.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1]::uuid in (select public.current_org_ids()));
create policy documents_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_write((storage.foldername(name))[1]::uuid));
create policy documents_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.can_write((storage.foldername(name))[1]::uuid));
create policy documents_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.can_delete((storage.foldername(name))[1]::uuid));
