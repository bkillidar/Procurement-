-- No user accounts in V1: issue owners are names.
alter table public.issues add column owner_label text;
-- A replacement/reorder item points back at the item it replaces.
alter table public.procurement_items add column replaces_item_id uuid references public.procurement_items(id) on delete set null;
create index procurement_replaces_idx on public.procurement_items(replaces_item_id);
