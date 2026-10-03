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

## Phase 4 — Deliveries, issues, photos, documents

Setup: an item with quantity 32, status Ordered or later. **Uploads need `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set in Vercel** (it is a public key, safe in the browser).

### Receiving
- [ ] An item that is not yet ordered shows no "Receive a delivery" form. An ordered/confirmed/shipped item does.
- [ ] Save a delivery with the quantity blank: item becomes Delivered, received quantity 32, actual delivery date set, no issue created, any tasks waiting on it become Ready.
- [ ] Receive 28 of 32: item "Partially delivered", an issue "partial delivery (28 of 32 received)" opens (medium). Receive the remaining 4 (blank quantity): item Delivered and the partial issue is resolved automatically.
- [ ] Tick Damaged: item becomes Problem; issue "Windows: damaged" opens (high; critical if required within 7 days).
- [ ] Receive more than ordered: flagged "incorrect quantity (N more than ordered)".
- [ ] Tick Replacement needed → "Order a replacement" appears; creating it makes a new "Replacement: …" item (Ready to order) that links back and shows "Replaced by" on the original.

### Photos
- [ ] On a phone, "Add photos" offers camera or library. Choose 2–3 photos: each shows ✓, thumbnails appear under the delivery.
- [ ] Photos taken on a phone (several MB) upload without error. Tap a thumbnail to open it full size. Delete asks for confirmation.
- [ ] A 1 MB PDF uploads from the Documents page; a file over 50 MB or an .exe is rejected with a message.

### Issues
- [ ] Issues → New issue: choose a project, then fill the form (type, severity, owner, due date, optional related material/task). Empty title is rejected.
- [ ] List: Open / Resolved / All tabs, search, type and severity filters; sorted most severe first; overdue due dates are red.
- [ ] Open an issue: add photos, change status to Resolved with a resolution. If it was the last open delivery issue for a "Problem" item, the item returns to Delivered (or Partially delivered if quantity is short).
- [ ] Reopen a resolved delivery issue: its item goes back to Problem.
- [ ] Dashboard shows "Open issues" and the open-issues list.

### Documents
- [ ] Documents page: pick project and type, upload; files appear under the right heading with links that open the file.
- [ ] Filters by project, type and name work. Delete removes the file.

## Phase 5 — Permits and utilities

Setup: a project created from a DC or Maryland renovation template with a start date ~100 days ago (so permit tasks are near/overdue).

### Add items
- [ ] Project page → "Permits & utilities" → "Add standard items from this project's tasks": creates Building permit plus Utilities items (gas, water, temporary power) with agencies filled in and each linked to its schedule task. Pressing it again says nothing new to add.
- [ ] Permits → Add item: pick a project, then a type (suggestions appear but any text works), agency, contact, linked task. Empty type is rejected.

### Status and dates
- [ ] Set status to Submitted: "Submitted on" fills with today if empty. Set Approved/Complete: "Approved / completed" fills in.
- [ ] Building permit → Approved: its "Building permit approved" task becomes Complete and following tasks become Ready. Gas cap-off → Approved does NOT complete its task; → Complete does.
- [ ] Move a completed permit back to Under review: the linked task goes to Waiting.

### Delay detection
- [ ] Submitted with a response date in the past: flagged "response was expected … (N days ago)".
- [ ] Submitted 3+ weeks ago with no response date: flagged "no response date".
- [ ] "Delayed" and "Additional information required" statuses are flagged.
- [ ] Not started/Preparing with its linked task due within 14 days: flagged (medium → high within 7 days → critical when overdue).
- [ ] Next follow-up date in the past: flagged. Approved/complete items are never flagged.

### Follow-ups and documents
- [ ] Log a follow-up with a next date: history shows it; "Last/Next follow-up" on the item update.
- [ ] Contact with a phone number shows "Call …" on the permit.
- [ ] Upload a PDF to a permit: it lists under Documents and also appears on the Documents page as "Permit documents".

### Lists and dashboard
- [ ] Permits tabs (Needs attention / In progress / Approved / All) and search work.
- [ ] Dashboard "Permits & utilities needing attention" and the "Permit / utility delays" tile match the flagged items; project page shows flagged items.
