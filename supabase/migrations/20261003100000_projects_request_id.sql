-- Each "create project" form carries a one-time id so a double tap cannot create two projects.
alter table public.projects add column request_id uuid;
create unique index projects_request_id_uniq on public.projects(request_id) where request_id is not null;
