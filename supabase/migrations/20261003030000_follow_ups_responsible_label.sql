-- No user accounts in V1: who is responsible for a follow-up is a name.
alter table public.follow_ups add column responsible_label text;
