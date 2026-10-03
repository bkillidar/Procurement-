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
