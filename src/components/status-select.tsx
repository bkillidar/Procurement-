"use client";

import { useRef } from "react";

// A dropdown that saves as soon as it changes (no separate Save tap on a phone).
export function StatusSelect({
  action,
  taskId,
  value,
  options,
  className,
  idName = "task_id",
  hidden = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  taskId: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
  /** Name of the id field the action reads (defaults to task_id). */
  idName?: string;
  /** Extra hidden fields, e.g. the page to return to. */
  hidden?: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name={idName} value={taskId} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name="status"
        defaultValue={value}
        aria-label="Task status"
        className={className}
        onChange={() => formRef.current?.requestSubmit()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
