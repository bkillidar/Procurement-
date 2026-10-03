import "server-only";
import { cache } from "react";
import { getContext } from "@/lib/org";
import { dueState, todayISO } from "@/lib/dates";

export interface ProjectSummary {
  id: string;
  name: string;
  address: string | null;
  jurisdiction: string | null;
  project_type: string;
  status: string;
  target_completion_date: string | null;
  currentPhase: string | null;
  done: number;
  total: number;
  overdue: number;
}

export interface OpenTask {
  id: string;
  project_id: string;
  projectName: string;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
  assignee_label: string | null;
  phaseName: string | null;
}

/** Everything the dashboard and project list need, in three queries. */
export const loadPortfolio = cache(async function loadPortfolio() {
  const { db, orgId, orgName } = await getContext();
  const [projRes, phaseRes, taskRes] = await Promise.all([
    db
      .from("projects")
      .select("id, name, address, jurisdiction, project_type, status, target_completion_date, current_phase_id, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    db.from("project_phases").select("id, name").eq("organization_id", orgId),
    db
      .from("tasks")
      .select("id, project_id, phase_id, title, due_date, status, priority, assignee_label")
      .eq("organization_id", orgId),
  ]);
  for (const r of [projRes, phaseRes, taskRes]) if (r.error) throw new Error(r.error.message);

  const today = todayISO();
  const phaseName = new Map<string, string>((phaseRes.data ?? []).map((p) => [p.id, p.name]));
  const projectName = new Map<string, string>((projRes.data ?? []).map((p) => [p.id, p.name]));
  const tasks = taskRes.data ?? [];

  const projects: ProjectSummary[] = (projRes.data ?? []).map((p) => {
    const mine = tasks.filter((t) => t.project_id === p.id);
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      jurisdiction: p.jurisdiction,
      project_type: p.project_type,
      status: p.status,
      target_completion_date: p.target_completion_date,
      currentPhase: p.current_phase_id ? (phaseName.get(p.current_phase_id) ?? null) : null,
      done: mine.filter((t) => t.status === "complete").length,
      total: mine.length,
      overdue: mine.filter((t) => t.status !== "complete" && dueState(t.due_date, today) === "overdue").length,
    };
  });

  const activeIds = new Set(projects.filter((p) => p.status === "active" || p.status === "planning").map((p) => p.id));
  const open: OpenTask[] = tasks
    .filter((t) => t.status !== "complete" && activeIds.has(t.project_id))
    .map((t) => ({
      id: t.id,
      project_id: t.project_id,
      projectName: projectName.get(t.project_id) ?? "",
      title: t.title,
      due_date: t.due_date,
      status: t.status,
      priority: t.priority,
      assignee_label: t.assignee_label,
      phaseName: t.phase_id ? (phaseName.get(t.phase_id) ?? null) : null,
    }))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  return { orgName, today, projects, open };
});
