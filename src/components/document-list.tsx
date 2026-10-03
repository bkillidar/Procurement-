import { deleteDocument } from "@/app/actions/documents";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDate } from "@/lib/dates";
import { isImageType } from "@/lib/documents";
import type { DocumentView } from "@/lib/document-queries";

function size(n: number | null) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Photos as a thumbnail grid, everything else as a list. `back` is where to return after a delete. */
export function DocumentList({ docs, back }: { docs: DocumentView[]; back: string }) {
  if (docs.length === 0) return null;
  const photos = docs.filter((d) => isImageType(d.mime_type) && d.url);
  const files = docs.filter((d) => !(isImageType(d.mime_type) && d.url));
  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((d) => (
            <li key={d.id} className="space-y-1">
              <a href={d.url!} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md bg-slate-100">
                {/* Signed, short-lived storage URLs: next/image optimization does not apply. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.url!} alt={d.name} loading="lazy" className="h-full w-full object-cover" />
              </a>
              <form action={deleteDocument}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="back" value={back} />
                <ConfirmButton message="Delete this photo?" className="text-xs text-red-700 underline">
                  Delete
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {files.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="block truncate font-medium text-blue-700 underline">
                    {d.name}
                  </a>
                ) : (
                  <span className="block truncate">{d.name}</span>
                )}
                <span className="text-xs text-slate-500">
                  {formatDate(d.created_at.slice(0, 10))} {size(d.size_bytes) && `· ${size(d.size_bytes)}`}
                </span>
              </div>
              <form action={deleteDocument}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="back" value={back} />
                <ConfirmButton message={`Delete ${d.name}?`} className="text-xs text-red-700 underline">
                  Delete
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
