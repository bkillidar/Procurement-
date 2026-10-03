import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { loadItems } from "@/lib/procurement-queries";
import { loadDocuments } from "@/lib/document-queries";
import { isOpenIssue, ISSUE_STATUS_LABELS } from "@/lib/issues";
import { formatDate, todayISO } from "@/lib/dates";
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  isPreOrder,
  isReceived,
  UNCONFIRMED,
  type ItemStatus,
} from "@/lib/procurement";
import {
  addFollowUp,
  addQuote,
  confirmOrder,
  deleteItem,
  deleteQuote,
  placeOrder,
  selectQuote,
  setExpectedDelivery,
  setItemStatus,
  updateItem,
} from "@/app/actions/procurement";
import { createReplacement, receiveDelivery } from "@/app/actions/deliveries";
import { ConfirmButton } from "@/components/confirm-button";
import { DocumentList } from "@/components/document-list";
import { FileUploader } from "@/components/file-uploader";
import {
  cardClass,
  dangerButton,
  ErrorBanner,
  inputClass,
  ItemStatusBadge,
  labelClass,
  primaryButton,
  RiskBadge,
  secondaryButton,
  SeverityBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const METHODS = [
  ["phone", "Phone call"],
  ["email", "Email"],
  ["text", "Text message"],
  ["in_person", "In person"],
  ["portal", "Vendor portal"],
  ["other", "Other"],
] as const;

function money(n: number | null | undefined) {
  return n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function Fact({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-sm ${emphasize ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

export default async function ItemPage(props: PageProps<"/procurement/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { db, orgId } = await getContext();
  const { items } = await loadItems();
  const item = items.find((i) => i.id === id);
  if (!item) notFound();

  const [{ data: deliveries }, { data: issues }, docs] = await Promise.all([
    db.from("deliveries").select("*").eq("organization_id", orgId).eq("procurement_item_id", id).order("received_on", { ascending: false }),
    db.from("issues").select("id, title, severity, status, due_date").eq("organization_id", orgId).eq("procurement_item_id", id).order("created_at", { ascending: false }),
    loadDocuments({ procurementItemId: id }),
  ]);
  const replacedBy = items.filter((i) => i.replaces_item_id === id);
  const replaces = item.replaces_item_id ? items.find((i) => i.id === item.replaces_item_id) : undefined;

  const [{ data: vendors }, { data: quotes }, { data: followUps }, { data: deps }] = await Promise.all([
    db.from("vendors").select("id, name, phone, email, typical_lead_time_days").eq("organization_id", orgId).order("name"),
    db.from("procurement_quotes").select("*").eq("organization_id", orgId).eq("procurement_item_id", id).order("created_at", { ascending: false }),
    db.from("follow_ups").select("*").eq("organization_id", orgId).eq("procurement_item_id", id).order("contacted_at", { ascending: false }),
    db.from("task_dependencies").select("task_id").eq("organization_id", orgId).eq("depends_on_procurement_item_id", id),
  ]);
  const taskIds = (deps ?? []).map((d) => d.task_id);
  const { data: tasks } = taskIds.length
    ? await db.from("tasks").select("id, title, due_date, status").eq("organization_id", orgId).in("id", taskIds)
    : { data: [] };

  const vendorById = new Map((vendors ?? []).map((v) => [v.id, v]));
  const vendor = item.vendor_id ? vendorById.get(item.vendor_id) : undefined;
  const today = todayISO();
  const status = item.status as ItemStatus;
  const awaitingConfirm = UNCONFIRMED.includes(status);
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <div className="space-y-5">
      <Link href="/procurement" className="text-sm text-slate-500 hover:underline">
        ← Procurement
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{item.description}</h1>
        <p className="text-sm text-slate-600">
          {item.category} ·{" "}
          <Link href={`/projects/${item.project_id}`} className="underline">
            {item.projectName}
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ItemStatusBadge status={item.status} />
          <RiskBadge level={item.risk.level} />
        </div>
      </div>

      <ErrorBanner message={error} />

      {/* Why is this flagged? */}
      {(item.risk.risks.length > 0 || item.followUp.state !== "none") && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Why this is flagged</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {item.risk.risks.map((r) => (
              <li key={r.code + r.message}>{r.message}</li>
            ))}
            {item.followUp.state !== "none" && item.risk.risks.every((r) => r.code !== "follow_up_overdue") && (
              <li>{item.followUp.message}</li>
            )}
          </ul>
        </section>
      )}

      {/* Vendor quick actions */}
      {vendor && (vendor.phone || vendor.email) && (
        <div className="flex gap-2">
          {vendor.phone && (
            <a href={`tel:${vendor.phone}`} className={`${secondaryButton} flex-1 text-center`}>
              📞 Call {vendor.name}
            </a>
          )}
          {vendor.email && (
            <a href={`mailto:${vendor.email}`} className={`${secondaryButton} flex-1 text-center`}>
              ✉️ Email
            </a>
          )}
        </div>
      )}

      <section className={`${cardClass} p-4`}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Fact label="Required on site" value={formatDate(item.required_on_site_date)} emphasize />
          <Fact label="Lead time" value={item.risk.leadTimeDays != null ? `${item.risk.leadTimeDays} days` : "—"} />
          <Fact label="Recommended order date" value={formatDate(item.risk.recommendedOrderDate)} />
          <Fact label="Vendor" value={item.vendorName ?? "Not chosen"} />
          <Fact label="Order date" value={formatDate(item.actual_order_date)} />
          <Fact label="PO / order #" value={item.order_number ?? "—"} />
          <Fact label="Vendor confirmed" value={item.vendor_confirmed_at ? formatDate(item.vendor_confirmed_at.slice(0, 10)) : "No"} />
          <Fact label="Expected delivery" value={formatDate(item.expected_delivery_date)} emphasize />
          <Fact label="Delivered" value={formatDate(item.actual_delivery_date)} />
          <Fact label="Quote" value={money(item.quote_amount)} />
          <Fact label="Final cost" value={money(item.final_cost)} />
          <Fact
            label="Quantity"
            value={item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "—"}
          />
        </dl>
        {item.specification && <p className="mt-3 text-sm text-slate-700"><strong>Spec:</strong> {item.specification}</p>}
        {item.source_reference && <p className="mt-1 text-sm text-slate-700"><strong>Reference:</strong> {item.source_reference}</p>}
        {item.vendor_confirmation_notes && <p className="mt-1 text-sm text-slate-700"><strong>Vendor said:</strong> {item.vendor_confirmation_notes}</p>}
        {item.notes && <p className="mt-1 text-sm text-slate-700"><strong>Notes:</strong> {item.notes}</p>}
      </section>

      {/* Next step */}
      {(isPreOrder(status) || awaitingConfirm) && (
        <section className={`${cardClass} space-y-3 p-4`}>
          {isPreOrder(status) ? (
            <>
              <h2 className="font-medium">Place the order</h2>
              <form action={placeOrder} className="space-y-3">
                <input type="hidden" name="item_id" value={item.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Vendor *</label>
                    <select name="vendor_id" defaultValue={item.vendor_id ?? ""} required className={inputClass}>
                      <option value="" disabled>Choose…</option>
                      {(vendors ?? []).map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Order date *</label>
                    <input type="date" name="actual_order_date" required defaultValue={today} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>PO / order number</label>
                    <input name="order_number" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Final cost</label>
                    <input name="final_cost" type="number" step="0.01" min={0} inputMode="decimal" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Expected delivery (if known)</label>
                    <input type="date" name="expected_delivery_date" defaultValue={item.expected_delivery_date ?? ""} className={inputClass} />
                  </div>
                </div>
                <SubmitButton className={primaryButton}>Mark as ordered</SubmitButton>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-medium">Vendor confirmation</h2>
              <p className="text-sm text-slate-600">Record it once the vendor confirms the order and gives a delivery date.</p>
              <form action={confirmOrder} className="space-y-3">
                <input type="hidden" name="item_id" value={item.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Confirmed on *</label>
                    <input type="date" name="confirmed_on" required defaultValue={today} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Expected delivery</label>
                    <input type="date" name="expected_delivery_date" defaultValue={item.expected_delivery_date ?? ""} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>What did the vendor say?</label>
                  <input name="notes" className={inputClass} />
                </div>
                <SubmitButton className={primaryButton}>Record confirmation</SubmitButton>
              </form>
            </>
          )}
        </section>
      )}

      {!isPreOrder(status) && (
        <section className={`${cardClass} space-y-2 p-4`}>
          <h2 className="font-medium">Delivery date</h2>
          <form action={setExpectedDelivery} className="flex gap-2">
            <input type="hidden" name="item_id" value={item.id} />
            <input type="date" name="expected_delivery_date" required defaultValue={item.expected_delivery_date ?? ""} className={inputClass} />
            <button className={secondaryButton}>Update</button>
          </form>
          <p className="text-xs text-slate-500">Changes are recorded in the activity history.</p>
        </section>
      )}


      {/* Receiving */}
      {!isPreOrder(status) && !isReceived(status) && (
        <section className={`${cardClass} space-y-3 p-4`}>
          <h2 className="font-medium">Receive a delivery</h2>
          <form action={receiveDelivery} className="space-y-3">
            <input type="hidden" name="item_id" value={item.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Date received *</label>
                <input type="date" name="received_on" required defaultValue={today} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>
                  Quantity received{item.quantity != null ? ` (ordered ${item.quantity}${item.unit ? ` ${item.unit}` : ""}${Number(item.quantity_received) ? `, ${item.quantity_received} already in` : ""})` : ""}
                </label>
                <input name="quantity_received" type="number" step="any" min={0} inputMode="decimal" className={inputClass} placeholder={item.quantity != null ? "Blank = all outstanding" : ""} />
              </div>
            </div>
            <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium text-slate-700">Anything wrong?</legend>
              {(
                [
                  ["is_partial", "Partial delivery (more still to come)"],
                  ["has_damage", "Damaged"],
                  ["has_missing_items", "Missing components or accessories"],
                  ["has_incorrect_items", "Wrong product"],
                  ["needs_replacement", "Replacement / reorder needed"],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="flex items-center gap-3 py-1 text-base">
                  <input type="checkbox" name={name} className="h-5 w-5" />
                  {label}
                </label>
              ))}
              <p className="text-xs text-slate-500">Any problem opens an issue automatically. Add photos right after saving.</p>
            </fieldset>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea name="notes" rows={2} className={inputClass} />
            </div>
            <SubmitButton className={primaryButton}>Save delivery</SubmitButton>
          </form>
        </section>
      )}

      {((deliveries ?? []).length > 0 || (issues ?? []).length > 0 || replaces || replacedBy.length > 0) && (
        <section className={`${cardClass} space-y-4 p-4`}>
          <h2 className="font-medium">Deliveries and problems</h2>
          {replaces && (
            <p className="text-sm">
              Replacement for{" "}
              <Link href={`/procurement/${replaces.id}`} className="underline">{replaces.description}</Link>
            </p>
          )}
          {replacedBy.map((r) => (
            <p key={r.id} className="text-sm">
              Replaced by <Link href={`/procurement/${r.id}`} className="underline">{r.description}</Link>{" "}
              <ItemStatusBadge status={r.status} />
            </p>
          ))}
          {(issues ?? []).length > 0 && (
            <ul className="space-y-2">
              {(issues ?? []).map((i) => (
                <li key={i.id}>
                  <Link href={`/issues/${i.id}`} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50">
                    <span>
                      <span className="block font-medium">{i.title}</span>
                      <span className="text-slate-500">
                        {ISSUE_STATUS_LABELS[i.status]}
                        {isOpenIssue(i.status) && i.due_date ? ` · due ${formatDate(i.due_date)}` : ""}
                      </span>
                    </span>
                    <SeverityBadge severity={i.severity} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(deliveries ?? []).map((d) => {
            const flags = [
              d.has_damage && "damaged",
              d.has_missing_items && "missing items",
              d.has_incorrect_items && "wrong product",
              d.needs_replacement && "replacement needed",
              d.is_partial && "partial",
            ].filter(Boolean);
            return (
              <div key={d.id} id={`delivery-${d.id}`} className="space-y-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                <p className="text-sm">
                  <strong>{formatDate(d.received_on)}</strong> · received {d.quantity_received ?? "?"}
                  {item.unit ? ` ${item.unit}` : ""}
                  {flags.length > 0 && <span className="text-red-700"> · {flags.join(", ")}</span>}
                </p>
                {d.notes && <p className="text-sm text-slate-600">{d.notes}</p>}
                <FileUploader
                  projectId={item.project_id}
                  category="delivery_photo"
                  links={{ delivery_id: d.id, procurement_item_id: item.id }}
                  label="📷 Add photos"
                  accept="image/*"
                />
                <DocumentList docs={docs.filter((x) => x.delivery_id === d.id)} back={`/procurement/${item.id}`} />
              </div>
            );
          })}
          {(deliveries ?? []).some((d) => d.needs_replacement) || status === "problem" ? (
            <form action={createReplacement} className="space-y-2 border-t border-slate-100 pt-3">
              <input type="hidden" name="item_id" value={item.id} />
              <p className="text-sm font-medium">Order a replacement</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Quantity</label>
                  <input name="quantity" type="number" step="any" min={0} defaultValue={item.quantity ?? ""} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <input name="notes" className={inputClass} />
                </div>
              </div>
              <button className={secondaryButton}>Create replacement item</button>
              <p className="text-xs text-slate-500">Copies the specification, vendor, lead time and required date to a new item.</p>
            </form>
          ) : null}
        </section>
      )}

      {/* Quotes */}
      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-medium">Quotes</h2>
        {(quotes ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No quotes yet.</p>
        ) : (
          <ul className="space-y-2">
            {(quotes ?? []).map((q) => (
              <li key={q.id} className={`rounded-md border p-3 text-sm ${q.is_selected ? "border-green-400 bg-green-50" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {q.vendor_id ? (vendorById.get(q.vendor_id)?.name ?? "Vendor") : "No vendor"} · {money(q.amount)}
                      {q.is_selected && <span className="ml-2 text-green-700">✓ Selected</span>}
                    </p>
                    <p className="text-slate-600">
                      {q.lead_time_days != null ? `${q.lead_time_days}-day lead time` : "Lead time unknown"}
                      {q.quoted_on ? ` · quoted ${formatDate(q.quoted_on)}` : ""}
                      {q.valid_until ? ` · valid to ${formatDate(q.valid_until)}` : ""}
                    </p>
                    {q.availability_notes && <p className="text-slate-600">{q.availability_notes}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!q.is_selected && isPreOrder(status) && (
                      <form action={selectQuote}>
                        <input type="hidden" name="item_id" value={item.id} />
                        <input type="hidden" name="quote_id" value={q.id} />
                        <button className={secondaryButton}>Select</button>
                      </form>
                    )}
                    <form action={deleteQuote}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="quote_id" value={q.id} />
                      <ConfirmButton message="Delete this quote?" className="text-xs text-red-700 underline">
                        Delete
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add a quote</summary>
          <form action={addQuote} className="mt-3 space-y-3">
            <input type="hidden" name="item_id" value={item.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Vendor</label>
                <select name="vendor_id" defaultValue="" className={inputClass}>
                  <option value="">—</option>
                  {(vendors ?? []).map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Amount</label>
                <input name="amount" type="number" step="0.01" min={0} inputMode="decimal" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Lead time (days)</label>
                <input name="lead_time_days" type="number" min={0} step={1} inputMode="numeric" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Quoted on</label>
                <input name="quoted_on" type="date" defaultValue={today} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Valid until</label>
                <input name="valid_until" type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Availability</label>
                <input name="availability_notes" className={inputClass} placeholder="In stock / 6 weeks / backordered" />
              </div>
            </div>
            <button className={secondaryButton}>Save quote</button>
          </form>
        </details>
        <p className="text-xs text-slate-500">Selecting a quote sets the vendor, quote amount and lead time on the item.</p>
      </section>

      {/* Follow-ups */}
      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-medium">Vendor follow-ups</h2>
        <form action={addFollowUp} className="space-y-3">
          <input type="hidden" name="item_id" value={item.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>How did you reach them?</label>
              <select name="method" defaultValue="phone" className={inputClass}>
                {METHODS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Next follow-up</label>
              <input type="date" name="next_follow_up_on" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Result</label>
              <input name="result" className={inputClass} placeholder="Left voicemail / promised Friday" />
            </div>
            <div>
              <label className={labelClass}>Responsible</label>
              <input name="responsible_label" className={inputClass} placeholder="Owner, PM…" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" rows={2} className={inputClass} />
          </div>
          <SubmitButton className={primaryButton}>Log follow-up</SubmitButton>
        </form>
        {(followUps ?? []).length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {(followUps ?? []).map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <p>
                  <strong>{formatDate(f.contacted_at.slice(0, 10))}</strong> ·{" "}
                  {METHODS.find((m) => m[0] === f.method)?.[1] ?? f.method}
                  {f.responsible_label ? ` · ${f.responsible_label}` : ""}
                </p>
                {f.result && <p className="text-slate-700">{f.result}</p>}
                {f.notes && <p className="text-slate-500">{f.notes}</p>}
                {f.next_follow_up_on && <p className="text-xs text-slate-500">Next follow-up {formatDate(f.next_follow_up_on)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Downstream tasks */}
      {(tasks ?? []).length > 0 && (
        <section className={`${cardClass} space-y-2 p-4`}>
          <h2 className="font-medium">Work waiting on this material</h2>
          <ul className="space-y-1 text-sm">
            {(tasks ?? []).map((t) => (
              <li key={t.id}>
                <Link href={`/projects/${item.project_id}#task-${t.id}`} className="underline">
                  {t.title}
                </Link>{" "}
                <span className="text-slate-500">· due {formatDate(t.due_date)} · {t.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Edit / status override / delete */}
      <details className={`${cardClass} p-4`}>
        <summary className="cursor-pointer font-medium">Edit details</summary>
        <form action={updateItem} className="mt-4 space-y-3">
          <input type="hidden" name="item_id" value={item.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Category *</label>
              <input name="category" required defaultValue={item.category} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Description *</label>
              <input name="description" required defaultValue={item.description} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Specification</label>
            <textarea name="specification" rows={2} defaultValue={item.specification ?? ""} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Quantity</label>
              <input name="quantity" type="number" step="any" min={0} defaultValue={item.quantity ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Unit</label>
              <input name="unit" defaultValue={item.unit ?? ""} className={inputClass} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>A/E reference</label>
              <input name="source_reference" defaultValue={item.source_reference ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Required on site</label>
              <input name="required_on_site_date" type="date" defaultValue={item.required_on_site_date ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Lead time (days)</label>
              <input name="estimated_lead_time_days" type="number" min={0} step={1} defaultValue={item.estimated_lead_time_days ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Vendor</label>
              <select name="vendor_id" defaultValue={item.vendor_id ?? ""} className={inputClass}>
                <option value="">Not chosen</option>
                {(vendors ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" rows={2} defaultValue={item.notes ?? ""} className={inputClass} />
          </div>
          <button className={secondaryButton}>Save changes</button>
        </form>

        <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
          <form action={setItemStatus} className="flex items-end gap-2">
            <input type="hidden" name="item_id" value={item.id} />
            <div className="flex-1">
              <label className={labelClass}>Override status</label>
              <select name="status" defaultValue={item.status} className={inputClass}>
                {ITEM_STATUSES.map((s) => (
                  <option key={s} value={s}>{ITEM_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <button className={secondaryButton}>Set</button>
          </form>
          <form action={deleteItem}>
            <input type="hidden" name="item_id" value={item.id} />
            <ConfirmButton message={`Delete “${item.description}” and its quotes and follow-ups?`} className={dangerButton}>
              Delete item
            </ConfirmButton>
          </form>
        </div>
      </details>
    </div>
  );
}
