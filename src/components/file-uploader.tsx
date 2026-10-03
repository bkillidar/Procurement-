"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { prepareUpload, recordDocument, type UploadLinks } from "@/app/actions/documents";
import { DOCUMENT_BUCKET } from "@/lib/documents";

type Row = { name: string; state: "working" | "done" | "error"; message?: string };

// Phone photos are 3–10 MB; shrink them on the device first (faster, cheaper, plenty sharp for site photos).
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function FileUploader({
  projectId,
  category,
  links,
  label = "Add files",
  accept,
  multiple = true,
  className,
}: {
  projectId: string;
  category: string;
  links?: UploadLinks;
  label?: string;
  accept?: string;
  multiple?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    setRows(files.map((f) => ({ name: f.name, state: "working" })));

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setRows(files.map((f) => ({ name: f.name, state: "error", message: "Uploads need NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY set in Vercel" })));
      return;
    }
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    for (let i = 0; i < files.length; i++) {
      try {
        const file = await shrinkImage(files[i]);
        const contentType = file.type || "application/octet-stream";
        const prep = await prepareUpload({ projectId, fileName: file.name, contentType, size: file.size });
        if (!prep.ok) throw new Error(prep.error);
        const { error } = await supabase.storage.from(DOCUMENT_BUCKET).uploadToSignedUrl(prep.path, prep.token, file, { contentType });
        if (error) throw new Error(error.message);
        const rec = await recordDocument({ projectId, path: prep.path, name: file.name, contentType, size: file.size, category, links });
        if (!rec.ok) throw new Error(rec.error);
        setRow(i, { state: "done" });
      } catch (e) {
        setRow(i, { state: "error", message: e instanceof Error ? e.message : "Upload failed" });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const busy = rows.some((r) => r.state === "working");
  return (
    <div className={className}>
      <label
        className={`inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-50 ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? "Uploading…" : label}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm" aria-live="polite">
          {rows.map((r, i) => (
            <li key={i} className={r.state === "error" ? "text-red-700" : r.state === "done" ? "text-green-700" : "text-slate-600"}>
              {r.state === "done" ? "✓" : r.state === "error" ? "✗" : "…"} {r.name}
              {r.message ? ` — ${r.message}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
