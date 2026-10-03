"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { contactSchema, firstError, vendorSchema } from "@/lib/validation";

function done(path: string, error?: string): never {
  revalidatePath(path);
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

async function insertRow(table: "contacts" | "vendors", values: Record<string, unknown>, path: string) {
  let error: string | undefined;
  try {
    const { db, orgId } = await getContext();
    const { error: e } = await db.from(table).insert({ ...values, organization_id: orgId });
    if (e) throw new Error(e.message);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not save";
  }
  done(path, error);
}

async function deleteRow(table: "contacts" | "vendors", formData: FormData, path: string) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) done(path);
  let error: string | undefined;
  try {
    const { db, orgId } = await getContext();
    const { error: e } = await db.from(table).delete().eq("id", id.data).eq("organization_id", orgId);
    if (e) throw new Error(e.message);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not delete";
  }
  done(path, error);
}

export async function addContact(formData: FormData) {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) done("/contacts", firstError(parsed.error));
  await insertRow("contacts", parsed.data, "/contacts");
}

export async function deleteContact(formData: FormData) {
  await deleteRow("contacts", formData, "/contacts");
}

export async function addVendor(formData: FormData) {
  const parsed = vendorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) done("/vendors", firstError(parsed.error));
  await insertRow("vendors", parsed.data, "/vendors");
}

export async function deleteVendor(formData: FormData) {
  await deleteRow("vendors", formData, "/vendors");
}
