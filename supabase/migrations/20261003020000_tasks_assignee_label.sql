-- V1 has no user accounts, so tasks are assigned by name ("Owner", "PM", a subcontractor).
-- assignee_id stays for when real users are added.
alter table public.tasks add column assignee_label text;
