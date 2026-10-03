// Pure rules for task status, dependencies and phase progression.

export type TaskStatus = "not_started" | "ready" | "in_progress" | "waiting" | "blocked" | "complete";

export const TASK_STATUSES: TaskStatus[] = [
  "not_started",
  "ready",
  "in_progress",
  "waiting",
  "blocked",
  "complete",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  ready: "Ready",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  complete: "Complete",
};

/** A task with no dependencies can start immediately. */
export function initialStatus(dependencyCount: number): TaskStatus {
  return dependencyCount === 0 ? "ready" : "not_started";
}

/**
 * Status after something it depends on changed.
 * Only automatic states move: a task a person is actively working
 * (in progress / waiting / blocked / complete) is never overridden.
 */
export function statusAfterDependencyChange(current: TaskStatus, dependencyStatuses: string[]): TaskStatus {
  if (current !== "not_started" && current !== "ready") return current;
  const allDone = dependencyStatuses.every((s) => s === "complete");
  return allDone ? "ready" : "not_started";
}

export type PhaseStatus = "not_started" | "in_progress" | "complete";

export interface PhaseInput {
  id: string;
  position: number;
}

export interface PhaseState {
  phaseStatuses: Record<string, PhaseStatus>;
  /** First phase that still has incomplete tasks, or the last phase when everything is done. */
  currentPhaseId: string | null;
}

/**
 * A phase is complete when it has tasks and all are complete. Phases with no
 * tasks never block progress. The current phase is the first one with open work.
 */
export function computePhaseState(
  phases: PhaseInput[],
  taskStatusesByPhase: Record<string, string[]>,
): PhaseState {
  const ordered = [...phases].sort((a, b) => a.position - b.position);
  const phaseStatuses: Record<string, PhaseStatus> = {};
  let currentPhaseId: string | null = null;

  for (const phase of ordered) {
    const statuses = taskStatusesByPhase[phase.id] ?? [];
    const hasOpenWork = statuses.some((s) => s !== "complete");
    if (statuses.length > 0 && !hasOpenWork) {
      phaseStatuses[phase.id] = "complete";
    } else if (hasOpenWork && currentPhaseId === null) {
      currentPhaseId = phase.id;
      phaseStatuses[phase.id] = "in_progress";
    } else {
      phaseStatuses[phase.id] = "not_started";
    }
  }

  if (currentPhaseId === null && ordered.length > 0) {
    currentPhaseId = ordered[ordered.length - 1].id;
  }
  return { phaseStatuses, currentPhaseId };
}

/** True if adding "taskId depends on dependsOnId" would create a cycle. */
export function wouldCreateCycle(
  edges: { taskId: string; dependsOnId: string }[],
  taskId: string,
  dependsOnId: string,
): boolean {
  if (taskId === dependsOnId) return true;
  // Walk dependencies of `dependsOnId`; if we reach `taskId`, it's a cycle.
  const deps = new Map<string, string[]>();
  for (const e of edges) deps.set(e.taskId, [...(deps.get(e.taskId) ?? []), e.dependsOnId]);
  const seen = new Set<string>();
  const stack = [dependsOnId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(deps.get(cur) ?? []));
  }
  return false;
}
