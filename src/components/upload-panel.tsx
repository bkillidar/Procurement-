"use client";

import { useState } from "react";
import { FileUploader } from "@/components/file-uploader";
import { CATEGORY_LABELS, DOCUMENT_CATEGORIES } from "@/lib/documents";

const select =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none";

/** Pick a project and category, then upload. Used on the Documents page. */
export function UploadPanel({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [category, setCategory] = useState("plan");
  if (projects.length === 0) return <p className="text-sm text-slate-500">Create a project before uploading documents.</p>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Project
          <select className={select} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Type
          <select className={select} value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FileUploader key={projectId + category} projectId={projectId} category={category} label="⬆️ Choose files to upload" />
      <p className="text-xs text-slate-500">PDFs, photos, Word/Excel files. Up to 50 MB each. Photos are resized automatically.</p>
    </div>
  );
}
