# Manual QA checklist

Run on a phone and a laptop. Add a section here for each new phase.

## Phase 2 — Projects, tasks, contacts, vendors, templates

### Create a project from a template
- [ ] Projects → New project. Leave the name empty and submit: the browser asks for a name.
- [ ] Enter a name, choose "Renovation — DC", set a start date, create.
- [ ] You land on the project page. Phases are listed; "Feasibility" is the current phase and open.
- [ ] Due dates equal start date + the template offset (e.g. "Determine offer price" = start + 5 days).
- [ ] Set target completion before the start date: you get an error and the project is not created.
- [ ] Create a project with "No template": phases exist, no tasks.

### Tasks and dependencies
- [ ] "Feasibility analysis" is Ready; "Determine offer price" is Not started and says "Waiting on: Property feasibility analysis".
- [ ] Tap ✓ Done on "Property feasibility analysis": "Determine offer price" and "Obtain proof of funds" become Ready.
- [ ] Complete every Feasibility task: the phase chip turns green and "Acquisition" becomes the current phase.
- [ ] Reopen a completed task (status → In progress): tasks that depended only on it go back to Not started.
- [ ] Set a task to Waiting or Blocked by hand: finishing its dependencies does not change it.
- [ ] Details → add a dependency, then try to make a circular one (A→B then B→A): you get an error.
- [ ] Details → change due date, assignee, priority, notes → Save. Values persist after reload.
- [ ] Add a task from "+ Add a task" with a phase: it appears in that phase.
- [ ] Delete a task (confirm dialog): it disappears; tasks that depended on it are no longer waiting on it.

### Dashboard
- [ ] Overdue and "due in 7 days" lists match task due dates (use a start date in the past to create overdue tasks).
- [ ] Each project shows its current phase, progress bar and overdue count; tapping opens it.
- [ ] With no projects: "Create your first project" message.

### Contacts and vendors
- [ ] Add a contact with an invalid email: error banner. Valid one: it appears, phone/email are tappable.
- [ ] Search and type filter narrow the list. Delete asks for confirmation.
- [ ] Add a vendor with lead time -3 or 2.5: error. 28: saved and shown.

### Templates
- [ ] Three starter templates are listed; expanding one shows phases, day offsets and "after:" dependencies.

### Phone checks
- [ ] No horizontal scrolling except the nav bar and phase chips.
- [ ] Inputs do not zoom the page when focused; buttons are easy to tap.

## Phase 3 — Procurement

Setup: a project with a start date in the past (so tasks are overdue/near) and one vendor with a typical lead time of 28 days.

### Add and quote an item
- [ ] Procurement → Add item. Leave category blank: the browser asks for it. Lead time -1 or 2.5: error banner.
- [ ] Add "Windows", required on site ~3 weeks from today, lead time 28. Item opens as "Needs specification" (no spec) or "Ready for quote" (with spec).
- [ ] The page says why it is flagged: required date, 28-day lead time, "Order has not yet been placed", recommended order date in the past, and how late it would arrive.
- [ ] Choose a vendor and leave lead time blank: the vendor's typical lead time is used.
- [ ] Add two quotes (different vendors, amounts, lead times). Status becomes "Quoting". Select one: vendor, quote amount and lead time are copied to the item, status becomes "Ready to order".

### Order, confirm, deliver
- [ ] "Place the order" requires a vendor and order date. After saving: status "Awaiting vendor confirmation", order date and PO shown.
- [ ] Order date 4+ days ago with no confirmation: flagged "vendor has not confirmed" (medium); 7+ days: "At risk".
- [ ] Record vendor confirmation with an expected delivery date: status "Confirmed"; the unconfirmed flag disappears.
- [ ] Change the expected delivery date to after the required date: flagged "X days after the required on-site date". Change it to the past: flagged "was expected on … and has not been delivered".
- [ ] Override status to "Delivered": all flags disappear.

### Follow-ups
- [ ] Log a follow-up (phone, result, next follow-up date). It appears in the history; "Call vendor" opens the dialer on a phone.
- [ ] Next follow-up date in the past: item shows "Follow-up … was due …"; it appears under "Vendor follow-ups due" on the dashboard.
- [ ] Ordered item with no follow-up logged 3+ days after the order: shows as due.

### Downstream tasks
- [ ] On a project task, Details → "Waits for material…" → pick the item. The task now says "Waiting on: <item> (<status>)" and is Not started.
- [ ] Set that task due within 7 days while the item is not delivered: the item is flagged with the task name.
- [ ] Mark the item Delivered: the task becomes Ready.

### Lists and dashboard
- [ ] Procurement tabs (Needs attention / To order / Awaiting confirmation / On the way / Delivered / All) show matching counts; search works.
- [ ] Dashboard shows Procurement risks, Vendor follow-ups due, Late deliveries and Deliveries in the next 14 days; stat tiles link to filtered lists.
- [ ] Project page shows the Procurement card with flagged items.
