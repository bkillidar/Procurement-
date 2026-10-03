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

## Phase 6 — Punch list (do this on a phone)

Setup: a project in or near the Punch list phase. The template tasks "Create punch list" and "Complete punch list items" should exist (they are matched by title).

### Fast entry
- [ ] Project page → Punch list → "Start punch list". The Add item form is at the top; the room field suggests rooms (Kitchen, Primary bath…) and rooms already used.
- [ ] Type a description only and tap "Add item": it appears under "No location" without leaving the page. Empty description is blocked.
- [ ] Enter a room + description + priority and tap "Add + photos 📷": the item opens ready for photos.
- [ ] Add 5 items in different rooms in under a minute without scrolling away from the form.

### Photos
- [ ] On an item, "Take or add photos" opens the camera/library; upload 2–3 photos. Thumbnails show on the item and (up to 4) on the list. Tapping a thumbnail opens it full size.

### Assignment and status
- [ ] Assign a subcontractor (contact) or type a name; the contact's phone is tappable on the item.
- [ ] "Mark ready" moves it to Ready to verify and into the Verify tab. "✓ Verify" marks it Verified with today's date. The status dropdown saves on change.
- [ ] Reopen a verified item: verified date clears.
- [ ] Tabs (Open / Verify / Done / All) show counts; items are grouped by room, most urgent first; overdue dates are red.

### Schedule link
- [ ] Adding the first punch item completes "Create punch list" in the project's tasks.
- [ ] "Complete punch list items" completes only when every item is Verified or Won't fix — not while any is open or Ready to verify. Adding a new open item reopens it (In progress).
- [ ] When the Punch list phase tasks are all complete, the project advances to Completion.

### Overview
- [ ] Punch (top nav) lists projects with open / to verify / done counts; the dashboard tile "Open punch items" matches.

## Phase 7 — Dashboard, notifications, search, activity, tasks

Setup: use a project with some overdue tasks, a flagged material and a permit with a late response (the Phase 3–5 setups).

### Notifications
- [ ] The 🔔 in the header shows the number of unread alerts. Open it: alerts are sorted critical → warning → info and each says what is wrong and which project.
- [ ] Alerts exist for: overdue/due-tomorrow tasks, "Order now/soon" materials, vendor confirmation overdue, vendor follow-up due, delivery expected tomorrow/late, permit delays and follow-ups, overdue issues.
- [ ] "Open" goes to the right item. "Mark read" removes it and lowers the count; "Mark all read" clears everything.
- [ ] Fix the underlying problem (e.g. place the order): the alert disappears by itself. Change the situation (new expected date that slips again): a fresh alert appears even though the old one was marked read.

### Search
- [ ] Type 2+ characters in the header box (or Search page). Results are grouped (Projects, Tasks, Materials, Permits, Issues, Punch list, Vendors, Contacts, Documents) and each links to the right page.
- [ ] Symbols such as `%`, `_`, `,` and `(` in the search box do not cause errors.

### Tasks page
- [ ] Tasks → tabs Overdue / Due in 7 days / All open with counts; project, assignee and text filters work.
- [ ] "✓ Done" completes the task and returns to the same list (filters kept); dependents become Ready.

### Activity
- [ ] Activity shows orders, vendor changes, expected-delivery changes, deliveries, issues, permit status changes, punch verification, completed tasks and new projects, newest first, grouped by day; entries link to the item; project filter and "Show more" work.
- [ ] Project page shows "Recent activity" and the Dashboard shows the latest 8.

### Project and portfolio dashboards
- [ ] Project page opens with "Needs attention" pills (overdue tasks, flagged materials, permit delays, open issues, punch items) or a green "Nothing needs attention" message. Pills link to filtered lists.
- [ ] Dashboard sections are consistent with the lists they link to.

## Phase 8 — Production readiness

### Errors, loading, empty and not-found states
- [ ] Throttle the network (browser dev tools "Slow 3G") and open the Dashboard: grey placeholder blocks show while it loads.
- [ ] Open a project, material, permit, issue or punch URL with a made-up id (change a character in the address): "Not found" with a link back, not a crash.
- [ ] In Vercel, temporarily rename `SUPABASE_SECRET_KEY` and redeploy: the dashboard shows "One setup step left" instead of crashing. Restore and redeploy.
- [ ] A brand-new database shows friendly empty states on every list (Projects, Procurement, Permits, Issues, Documents, Punch, Activity, Notifications) with a hint on what to do next.

### Forms
- [ ] Every form rejects an empty required field (browser prompt) and, if that is bypassed, shows a red message from the server (e.g. negative lead time, bad email, completion before start, empty title).
- [ ] No form loses typed data silently: after an error you are returned to the same page with the message.

### Demo, delete, cleanup
- [ ] Projects → "Load a demo project": a "DEMO — 1420 Euclid St NW" project appears with flagged materials (one critical, others medium/high), a late shingle delivery, a partial drywall delivery with an issue, an overdue building-permit response and several notifications. Pressing the button again opens the same project instead of creating a second one.
- [ ] Upload a photo to a punch item, then delete the item: the photo disappears from the Documents page (and the file is removed from Storage).
- [ ] Project page → "Delete this project": typing the wrong name refuses; typing the exact name deletes everything, including its uploaded files, and returns to Projects.

### Sign-in and privacy
- [ ] Open the site in a private/incognito window: you land on the sign-in page and cannot reach any other page (try /projects, /issues).
- [ ] A wrong password shows "That email or password isn't right"; the right one lands on the dashboard (or the page you were trying to open).
- [ ] "Sign out" in the menu returns to the sign-in page, and the back button does not show data.
- [ ] Both accounts (you and Faris) can sign in on their own phones at the same time.
- [ ] In Supabase, try Authentication → Users → Add user with an email that is NOT in `allowed_emails`: it is refused ("not allowed to create an account").
- [ ] `/api/health` works signed out and returns only `{"ok":true}`.

### Security spot-checks
- [ ] View the page source or network tab: the secret key never appears.
- [ ] Supabase security advisor shows only the four RLS helper functions.
- [ ] Authentication → Users lists only you and Faris.
