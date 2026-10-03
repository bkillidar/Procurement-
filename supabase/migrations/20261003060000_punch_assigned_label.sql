-- Punch items can be assigned to a contact (subcontractor) and/or a plain name (no user accounts in V1).
alter table public.punch_list_items add column assigned_label text;
