-- V1 has no user accounts: notifications are company-wide (user_id null). The unique
-- index lets "mark as read" be stored once per notification key.
alter table public.notifications alter column user_id drop not null;
create unique index notifications_org_key_uniq on public.notifications(organization_id, dedupe_key) where user_id is null;
