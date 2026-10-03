import "server-only";
import { getContext } from "@/lib/org";
import { todayISO, daysBetween } from "@/lib/dates";
import { assessPermit, isClosedPermit, type PermitAssessment } from "@/lib/permits";

export interface PermitRow {
  id: string;
  project_id: string;
  item_type: string;
  agency: string | null;
  status: string;
  contact_id: string | null;
  task_id: string | null;
  reference_number: string | null;
  submitted_on: string | null;
  expected_response_date: string | null;
  last_follow_up_on: string | null;
  next_follow_up_on: string | null;
  approved_on: string | null;
  notes: string | null;
}

export interface PermitView extends PermitRow {
  projectName: string;
  contactName: string | null;
  linkedTask: { id: string; title: string; due_date: string | null; status: string } | null;
  risk: PermitAssessment;
  followUpDue: boolean;
}

export async function loadPermits(opts: { projectId?: string } = {}): Promise<{ today: string; permits: PermitView[] }> {
  const { db, orgId } = await getContext();
  let q = db.from("permits_utilities").select("*").eq("organization_id", orgId);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  const [permRes, projRes, contactRes, taskRes] = await Promise.all([
    q,
    db.from("projects").select("id, name").eq("organization_id", orgId),
    db.from("contacts").select("id, name").eq("organization_id", orgId),
    db.from("tasks").select("id, title, due_date, status").eq("organization_id", orgId),
  ]);
  for (const r of [permRes, projRes, contactRes, taskRes]) if (r.error) throw new Error(r.error.message);

  const today = todayISO();
  const projectName = new Map<string, string>((projRes.data ?? []).map((p) => [p.id, p.name]));
  const contactName = new Map<string, string>((contactRes.data ?? []).map((c) => [c.id, c.name]));
  const taskById = new Map((taskRes.data ?? []).map((t) => [t.id, t]));

  const permits: PermitView[] = ((permRes.data ?? []) as PermitRow[]).map((p) => {
    const task = p.task_id ? taskById.get(p.task_id) : undefined;
    const linkedTask = task ? { id: task.id, title: task.title, due_date: task.due_date, status: task.status } : null;
    return {
      ...p,
      projectName: projectName.get(p.project_id) ?? "",
      contactName: p.contact_id ? (contactName.get(p.contact_id) ?? null) : null,
      linkedTask,
      risk: assessPermit({ ...p, linkedTask }, today),
      followUpDue: !isClosedPermit(p.status) && !!p.next_follow_up_on && daysBetween(today, p.next_follow_up_on) <= 0,
    };
  });
  return { today, permits };
}
