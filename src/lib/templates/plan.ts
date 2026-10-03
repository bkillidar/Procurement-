import { addDays } from "@/lib/dates";
import { initialStatus, type TaskStatus } from "@/lib/tasks";

export type Priority = "low" | "medium" | "high" | "urgent";

export interface TemplateTaskDef {
  key: string;
  phase: string; // phase name
  title: string;
  description?: string | null;
  priority: Priority;
  offsetDays: number | null; // days after project start
  dependsOn: string[]; // keys of other tasks in the same template
}

export interface TemplateDef {
  phases: { name: string; position: number }[];
  tasks: TemplateTaskDef[];
}

export interface PlannedPhase {
  name: string;
  position: number;
  dueDate: string | null;
}

export interface PlannedTask {
  key: string;
  phase: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  status: TaskStatus;
  dependsOn: string[];
}

export interface ProjectPlan {
  phases: PlannedPhase[];
  tasks: PlannedTask[];
}

/**
 * Turns a template into concrete phases/tasks for a project starting on `startDate`.
 * Task due dates = start + offset. Phase due date = latest task due date in the phase.
 * Dependencies on keys that do not exist in the template are dropped.
 */
export function buildProjectPlan(template: TemplateDef, startDate: string | null): ProjectPlan {
  const keys = new Set(template.tasks.map((t) => t.key));

  const tasks: PlannedTask[] = template.tasks.map((t) => {
    const dependsOn = t.dependsOn.filter((k) => keys.has(k) && k !== t.key);
    return {
      key: t.key,
      phase: t.phase,
      title: t.title,
      description: t.description ?? null,
      priority: t.priority,
      dueDate: startDate && t.offsetDays !== null ? addDays(startDate, t.offsetDays) : null,
      status: initialStatus(dependsOn.length),
      dependsOn,
    };
  });

  const phases: PlannedPhase[] = [...template.phases]
    .sort((a, b) => a.position - b.position)
    .map((p) => {
      const dates = tasks.filter((t) => t.phase === p.name && t.dueDate).map((t) => t.dueDate!);
      return { name: p.name, position: p.position, dueDate: dates.length ? dates.sort().at(-1)! : null };
    });

  return { phases, tasks };
}
