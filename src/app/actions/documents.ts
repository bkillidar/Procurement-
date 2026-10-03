"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/org";
import {
  buildStoragePath,
  DOCUMENT_BUCKET,
  DOCUMENT_CATEGORIES,
  isAllowedType,
  MAX_UPLOAD_BYTES,
  pathBelongsTo,
} from "@/lib/documents";

const uuid = z.string().uuid();

// Which record each upload can be attached to, and whether the table has a project_id to check.
const LINK_TABLES = {
  procurement_item_id: { table: "procurement_items", hasProject: true },
  delivery_id: { table: "deliveries", hasProject: false },
  issue_id: { table: "issues", hasProject: true },
  task_id: { table: "tasks", hasProject: true },
  permit_id: { table: "permits_utilities", hasProject: true },
  punch_item_id: { table: "punch_list_items", hasProject: true },
} as const;

const linksSchema = z
  .object({
    procurement_item_id: uuid.optional(),
    delivery_id: uuid.optional(),
    issue_id: uuid.optional(),
    task_id: uuid.optional(),
    permit_id: uuid.optional(),
    punch_item_id: uuid.optional(),
  })
  .default({});

export type UploadLinks = z.input<typeof linksSchema>;
export type PrepareResult = { ok: true; path: string; token: string } | { ok: false; error: string };
export type RecordResult = { ok: true } | { ok: false; error: string };

async function assertProject(projectId: string) {
  const { db, orgId } = await getContext();
  const { data } = await db.from("projects").select("id").eq("id", projectId).eq("organization_id", orgId).maybeSingle();
  if (!data) throw new Error("Project not found");
  return { db, orgId };
}

/** Step 1 of an upload: validate and hand the browser a one-time signed upload slot. */
export async function prepareUpload(input: {
  projectId: string;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<PrepareResult> {
  try {
    const parsed = z
      .object({
        projectId: uuid,
        fileName: z.string().min(1).max(300),
        contentType: z.string().max(200),
        size: z.number().int().positive(),
      })
      .parse(input);
    if (parsed.size > MAX_UPLOAD_BYTES) throw new Error(`Files must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
    if (!isAllowedType(parsed.contentType || "application/octet-stream")) throw new Error("That file type is not allowed");
    const { db, orgId } = await assertProject(parsed.projectId);
    const path = buildStoragePath(orgId, parsed.projectId, randomUUID(), parsed.fileName);
    const { data, error } = await db.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "Could not start the upload");
    return { ok: true, path, token: data.token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

/** Step 2: after the browser uploaded the file, save its metadata. */
export async function recordDocument(input: {
  projectId: string;
  path: string;
  name: string;
  contentType: string;
  size: number;
  category: string;
  links?: UploadLinks;
}): Promise<RecordResult> {
  try {
    const parsed = z
      .object({
        projectId: uuid,
        path: z.string().min(1).max(500),
        name: z.string().min(1).max(300),
        contentType: z.string().max(200),
        size: z.number().int().nonnegative(),
        category: z.enum(DOCUMENT_CATEGORIES),
        links: linksSchema,
      })
      .parse(input);
    const { db, orgId } = await assertProject(parsed.projectId);
    if (!pathBelongsTo(parsed.path, orgId, parsed.projectId)) throw new Error("Invalid file location");

    const { data: exists } = await db.storage.from(DOCUMENT_BUCKET).exists(parsed.path);
    if (!exists) throw new Error("The file did not finish uploading");

    for (const [key, value] of Object.entries(parsed.links)) {
      if (!value) continue;
      const { table, hasProject } = LINK_TABLES[key as keyof typeof LINK_TABLES];
      let q = db.from(table).select("id").eq("id", value).eq("organization_id", orgId);
      if (hasProject) q = q.eq("project_id", parsed.projectId);
      const { data } = await q.maybeSingle();
      if (!data) throw new Error("The record this file belongs to was not found");
    }

    const { error } = await db.from("documents").insert({
      organization_id: orgId,
      project_id: parsed.projectId,
      category: parsed.category,
      name: parsed.name,
      storage_path: parsed.path,
      mime_type: parsed.contentType || null,
      size_bytes: parsed.size,
      ...parsed.links,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/documents");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the file" };
  }
}

export async function deleteDocument(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  const back = typeof formData.get("back") === "string" ? String(formData.get("back")) : "/documents";
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/documents";
  if (!id.success) redirect(safeBack);
  try {
    const { db, orgId } = await getContext();
    const { data: doc } = await db
      .from("documents")
      .select("id, storage_path")
      .eq("id", id.data)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (doc) {
      await db.storage.from(DOCUMENT_BUCKET).remove([doc.storage_path]);
      await db.from("documents").delete().eq("id", doc.id).eq("organization_id", orgId);
    }
  } catch (e) {
    console.error("deleteDocument failed:", e);
  }
  revalidatePath(safeBack);
  revalidatePath("/documents");
  redirect(safeBack);
}
