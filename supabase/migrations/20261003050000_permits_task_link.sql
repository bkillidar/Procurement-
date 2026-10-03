-- A permit/utility item can gate a schedule task; completing the permit completes the task.
alter table public.permits_utilities add column task_id uuid references public.tasks(id) on delete set null;
create index permits_task_idx on public.permits_utilities(task_id);
