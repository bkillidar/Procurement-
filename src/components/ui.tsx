import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/tasks";
import type { DueState } from "@/lib/dates";
import { formatDate } from "@/lib/dates";

export const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none";
export const labelClass = "block text-sm font-medium text-slate-700";
export const primaryButton =
  "rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-700 active:bg-slate-800";
export const secondaryButton =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
export const dangerButton =
  "rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50";
export const cardClass = "rounded-lg border border-slate-200 bg-white";

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  not_started: "bg-slate-100 text-slate-700",
  ready: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  waiting: "bg-amber-100 text-amber-800",
  blocked: "bg-red-100 text-red-800",
  complete: "bg-green-100 text-green-800",
};

export function StatusBadge({ status }: { status: string }) {
  const s = status as TaskStatus;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s] ?? STATUS_STYLES.not_started}`}>
      {TASK_STATUS_LABELS[s] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "medium" || priority === "low") return null;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        priority === "urgent" ? "bg-red-600 text-white" : "bg-orange-100 text-orange-800"
      }`}
    >
      {priority === "urgent" ? "Urgent" : "High"}
    </span>
  );
}

export function DueBadge({ due, state }: { due: string | null; state: DueState }) {
  if (!due) return <span className="text-xs text-slate-400">No due date</span>;
  const style =
    state === "overdue"
      ? "bg-red-100 text-red-800 font-semibold"
      : state === "today" || state === "soon"
        ? "bg-amber-100 text-amber-800"
        : "text-slate-600";
  const prefix = state === "overdue" ? "Overdue · " : state === "today" ? "Due today · " : "";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${style}`}>{prefix + formatDate(due)}</span>;
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-green-600" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600">
        {done}/{total}
      </span>
    </div>
  );
}
