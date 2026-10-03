-- Demo data: one realistic renovation project in the FIRST organization.
-- Run AFTER you have signed up (so an organization exists), in the Supabase
-- SQL Editor. Safe to re-run: it skips if the demo project already exists.
do $$
declare
  org uuid; owner_id uuid; proj uuid;
  v_win uuid; v_lumber uuid; v_cab uuid;
  ph_arch uuid; ph_permit uuid; ph_proc uuid; ph_con uuid;
begin
  select id into org from public.organizations order by created_at limit 1;
  if org is null then raise notice 'No organization yet - sign up first.'; return; end if;
  if exists (select 1 from public.projects where organization_id = org and name = 'Demo: 123 Maple St NW') then
    raise notice 'Demo project already exists.'; return;
  end if;
  select user_id into owner_id from public.org_members where organization_id = org and role = 'owner' limit 1;

  insert into public.projects (organization_id, name, address, jurisdiction, project_type, scope,
      acquisition_details, start_date, target_completion_date, status, created_by)
  values (org, 'Demo: 123 Maple St NW', '123 Maple St NW, Washington, DC', 'DC', 'renovation',
      'Full gut renovation, rear addition, new kitchen and 3 baths',
      'Closed 2026-08-01, $785,000, hard-money lender', current_date - 30, current_date + 150, 'active', owner_id)
  returning id into proj;

  insert into public.project_phases (organization_id, project_id, name, position, status) values
    (org, proj, 'Feasibility', 0, 'complete'), (org, proj, 'Acquisition', 1, 'complete'),
    (org, proj, 'Architecture', 2, 'complete'), (org, proj, 'Permitting', 3, 'in_progress'),
    (org, proj, 'Procurement', 4, 'in_progress'), (org, proj, 'Construction', 5, 'not_started'),
    (org, proj, 'Punch list', 6, 'not_started'), (org, proj, 'Completion', 7, 'not_started');
  select id into ph_permit from public.project_phases where project_id = proj and name = 'Permitting';
  select id into ph_proc   from public.project_phases where project_id = proj and name = 'Procurement';
  select id into ph_con    from public.project_phases where project_id = proj and name = 'Construction';
  update public.projects set current_phase_id = ph_proc where id = proj;

  insert into public.vendors (organization_id, name, category, phone, typical_lead_time_days, reliability_notes) values
    (org, 'Capital Window & Door', 'Windows', '202-555-0101', 28, 'Usually 1 week late on custom sizes') returning id into v_win;
  insert into public.vendors (organization_id, name, category, phone, typical_lead_time_days)
    values (org, 'Beltway Lumber', 'Framing lumber', '301-555-0142', 5) returning id into v_lumber;
  insert into public.vendors (organization_id, name, category, phone, typical_lead_time_days)
    values (org, 'Chesapeake Cabinetry', 'Kitchen cabinets', '703-555-0177', 42) returning id into v_cab;

  insert into public.permits_utilities (organization_id, project_id, item_type, agency, status, submitted_on,
      expected_response_date, next_follow_up_on, reference_number) values
    (org, proj, 'Long-form building permit', 'DC DOB', 'under_review', current_date - 21, current_date + 7, current_date - 1, 'B2600123'),
    (org, proj, 'Water cap-off', 'DC Water', 'not_started', null, null, current_date + 5, null);

  insert into public.tasks (organization_id, project_id, phase_id, title, status, priority, due_date) values
    (org, proj, ph_permit, 'Respond to DOB plan review comments', 'in_progress', 'high', current_date + 2),
    (org, proj, ph_proc, 'Confirm window order with vendor', 'waiting', 'high', current_date - 2),
    (org, proj, ph_con, 'Frame rear addition', 'not_started', 'medium', current_date + 45);

  insert into public.procurement_items (organization_id, project_id, category, description, specification,
      quantity, unit, source_reference, required_on_site_date, estimated_lead_time_days, vendor_id, status,
      target_order_date, notes) values
    (org, proj, 'Windows', 'Double-hung vinyl windows, mixed sizes', 'Andersen 100 series, white', 14, 'ea',
      'Sheet A-6.1 window schedule', current_date + 38, 28, v_win, 'ready_to_order', current_date + 10,
      'Not ordered yet. Lead time leaves little slack.'),
    (org, proj, 'Framing lumber', '2x6 and 2x10 framing package', 'SPF #2', 1, 'lot', 'S-1.0',
      current_date + 40, 5, v_lumber, 'quoting', current_date + 33, null),
    (org, proj, 'Kitchen cabinets', 'Shaker kitchen cabinets, painted', 'Per kitchen elevations', 1, 'set', 'A-7.2',
      current_date + 70, 42, v_cab, 'ordered', current_date - 3, 'Order placed; no confirmation yet.');
  update public.procurement_items set actual_order_date = current_date - 3, order_number = 'PO-1001'
    where project_id = proj and category = 'Kitchen cabinets';
end $$;
