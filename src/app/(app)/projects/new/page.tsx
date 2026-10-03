import Link from "next/link";
import { randomUUID } from "node:crypto";
import { SubmitButton } from "@/components/submit-button";
import { createProject } from "@/app/actions/projects";
import { ensureDefaultTemplates, getContext } from "@/lib/org";
import { cardClass, ErrorBanner, inputClass, labelClass, primaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewProjectPage(props: PageProps<"/projects/new">) {
  const { error } = await props.searchParams;
  await ensureDefaultTemplates();
  const { db, orgId } = await getContext();
  const { data: templates } = await db
    .from("project_templates")
    .select("id, name, description")
    .eq("organization_id", orgId)
    .order("name");

  return (
    <div className="space-y-4">
      <Link href="/projects" className="text-sm text-slate-500 hover:underline">
        ← Projects
      </Link>
      <h1 className="text-2xl font-semibold">New project</h1>
      <ErrorBanner message={typeof error === "string" ? error : undefined} />
      <form action={createProject} className={`${cardClass} space-y-4 p-4`}>
        <input type="hidden" name="request_id" value={randomUUID()} />
        <div>
          <label className={labelClass} htmlFor="name">
            Project name *
          </label>
          <input id="name" name="name" required maxLength={200} className={inputClass} placeholder="e.g. 1420 Euclid St NW" />
        </div>
        <div>
          <label className={labelClass} htmlFor="address">
            Address
          </label>
          <input id="address" name="address" className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="project_type">
              Project type *
            </label>
            <select id="project_type" name="project_type" className={inputClass} defaultValue="renovation">
              <option value="renovation">Renovation / flip</option>
              <option value="new_construction">Ground-up new construction</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="jurisdiction">
              Jurisdiction
            </label>
            <select id="jurisdiction" name="jurisdiction" className={inputClass} defaultValue="">
              <option value="">—</option>
              <option value="DC">Washington, DC</option>
              <option value="MD">Maryland</option>
              <option value="VA">Virginia</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="template_id">
            Template
          </label>
          <select id="template_id" name="template_id" className={inputClass} defaultValue="">
            <option value="">No template (phases only, no tasks)</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            A template creates the phases, tasks, dependencies and due dates (counted from the start date).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="start_date">
              Start date
            </label>
            <input id="start_date" name="start_date" type="date" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="target_completion_date">
              Target completion
            </label>
            <input id="target_completion_date" name="target_completion_date" type="date" className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="scope">
            Scope of work
          </label>
          <textarea id="scope" name="scope" rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="acquisition_details">
            Acquisition details
          </label>
          <textarea id="acquisition_details" name="acquisition_details" rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="notes">
            Notes
          </label>
          <textarea id="notes" name="notes" rows={2} className={inputClass} />
        </div>
        <SubmitButton className={`${primaryButton} w-full sm:w-auto`}>Create project</SubmitButton>
      </form>
    </div>
  );
}
