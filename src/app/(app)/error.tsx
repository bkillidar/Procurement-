"use client";

import { useEffect } from "react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 rounded-lg border border-red-300 bg-red-50 p-6 text-center">
      <h1 className="text-lg font-semibold text-red-900">Something went wrong</h1>
      <p className="text-sm text-red-800">
        The page could not load. This is usually a brief connection problem with the database.
      </p>
      <button onClick={() => retry()} className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white">
        Try again
      </button>
      {error.digest && <p className="text-xs text-red-700">Reference: {error.digest}</p>}
    </div>
  );
}
