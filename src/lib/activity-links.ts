/** Where an activity-feed entry should link to. */
export function activityHref(entityType: string, entityId: string | null, projectId: string | null): string | null {
  switch (entityType) {
    case "procurement_item":
      return entityId ? `/procurement/${entityId}` : projectId ? `/projects/${projectId}` : null;
    case "issue":
      return entityId ? `/issues/${entityId}` : null;
    case "permit":
      return entityId ? `/permits/${entityId}` : projectId ? `/projects/${projectId}` : null;
    case "punch_item":
      return entityId ? `/punch/${entityId}` : projectId ? `/projects/${projectId}/punch` : null;
    case "task":
      return projectId ? `/projects/${projectId}${entityId ? `#task-${entityId}` : ""}` : null;
    case "project":
      return projectId ?? entityId ? `/projects/${projectId ?? entityId}` : null;
    default:
      return projectId ? `/projects/${projectId}` : null;
  }
}
