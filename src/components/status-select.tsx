"use client";

import { useRef } from "react";

// A dropdown that saves as soon as it changes (no separate Save tap on a phone).
export function StatusSelect({
  action,
  taskId,
  value,
  options,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  taskId: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="task_id" value={taskId} />
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
