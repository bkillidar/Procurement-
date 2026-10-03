// Finds accidental duplicate projects (same name and address) that are safe to remove.
// A project is "touched" once real work exists on it; touched projects are never removed.

export interface DupProject {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  touched: boolean;
}

const norm = (v: string | null) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Ids that can be deleted. Within each group of identical projects: every touched project is kept;
 * if none is touched, the oldest is kept. Everything else (untouched copies) is removable.
 */
export function findRemovableDuplicates(projects: DupProject[]): string[] {
  const groups = new Map<string, DupProject[]>();
  for (const p of projects) {
    const key = `${norm(p.name)}|${norm(p.address)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const remove: string[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const keepers = new Set(sorted.filter((p) => p.touched).map((p) => p.id));
    if (keepers.size === 0) keepers.add(sorted[0].id);
    for (const p of sorted) if (!keepers.has(p.id)) remove.push(p.id);
  }
  return remove;
}
