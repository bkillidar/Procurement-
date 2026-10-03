"use client";

import { useFormStatus } from "react-dom";

/** Submit button that disables itself while the form is saving, so a double tap cannot submit twice. */
export function SubmitButton({
  children,
  pendingText = "Saving…",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={`${className} ${pending ? "cursor-wait opacity-60" : ""}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
