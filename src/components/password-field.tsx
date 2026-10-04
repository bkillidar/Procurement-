"use client";

import { useState } from "react";

/** Password box with a "Show" toggle, so a typo on a phone is easy to spot. */
export function PasswordField({
  id,
  name,
  autoComplete,
  label,
  minLength,
  required = true,
}: {
  id: string;
  name: string;
  autoComplete: string;
  label: string;
  minLength?: number;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
