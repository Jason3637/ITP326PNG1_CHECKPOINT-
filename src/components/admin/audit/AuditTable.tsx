"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatReviewDate, parseBackendTimestamp } from "@/lib/application-review";
import {
  auditActor,
  auditChanges,
  auditDetailRows,
  auditEntityHref,
  auditEntityLabel,
  auditExactTime,
  auditLabel,
  auditSummary,
} from "@/lib/audit-log";
import { cn, focusRing } from "@/lib/utils";
import type { AuditLogItem } from "@/lib/types";

const linkClass = cn("rounded font-medium text-primary hover:text-primary-dark", focusRing);

function timeOfDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = parseBackendTimestamp(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Pacific/Port_Moresby" });
}

const actorId = (e: AuditLogItem) => (e.actor_id ? `#${e.actor_id}` : null);

function Record({ entry }: { entry: AuditLogItem }) {
  const href = auditEntityHref(entry);
  const label = auditEntityLabel(entry);
  return href ? (
    <Link href={href} className={linkClass}>
      {label}
    </Link>
  ) : (
    <span className="text-neutral-700">{label}</span>
  );
}

// The audit log as a table, newest first (the backend's order). One row
// per entry with what's needed to scan: when, who, what, on which record.
// "View" opens everything the entry carries, in a row beneath it - the
// exact time, the IP address, before/after values the backend recorded and
// every (non-hidden) detail field. Nothing is added that the backend
// didn't send: the actor is the user number the log stores.
//
// Narrower than md, User, Role and Record fold into a line under the
// action, so the table keeps three readable columns instead of shrinking
// six.
export function AuditTable({ items }: { items: AuditLogItem[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const th = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-neutral-500";
  const td = "px-4 py-3 align-top";

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Audit log entries, newest first</caption>
      <thead className="bg-neutral-50">
        <tr className="border-y border-neutral-200">
          <th scope="col" className={cn(th, "w-36")}>Date &amp; time</th>
          <th scope="col" className={cn(th, "hidden md:table-cell")}>User</th>
          <th scope="col" className={cn(th, "hidden md:table-cell")}>Role</th>
          <th scope="col" className={th}>Action</th>
          <th scope="col" className={cn(th, "hidden md:table-cell")}>Record</th>
          <th scope="col" className={cn(th, "w-px text-right")}>
            <span className="sr-only">Details</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((e) => {
          const expanded = open.has(e.id);
          const detailId = `audit-entry-${e.id}`;
          const summary = auditSummary(e);
          const label = auditLabel(e.action);
          return (
            <Fragment key={e.id}>
              <tr className={cn("border-b border-neutral-100", expanded ? "bg-primary-light/30" : "hover:bg-neutral-50")}>
                <td className={cn(td, "whitespace-nowrap tabular-nums")}>
                  {e.created_at ? (
                    <>
                      <span className="block text-neutral-900">{formatReviewDate(e.created_at)}</span>
                      <span className="block text-helper text-neutral-600">{timeOfDay(e.created_at)}</span>
                    </>
                  ) : (
                    <span className="text-neutral-500">Time not recorded</span>
                  )}
                </td>
                <td className={cn(td, "hidden md:table-cell")}>
                  <span className="block font-medium tabular-nums text-neutral-900">{actorId(e) ?? "—"}</span>
                  {e.ip_address && <span className="block text-helper tabular-nums text-neutral-600">{e.ip_address}</span>}
                </td>
                <td className={cn(td, "hidden whitespace-nowrap text-neutral-700 md:table-cell")}>{auditActor(e.actor_role)}</td>
                <td className={td}>
                  <span className="block font-medium text-neutral-900">{label}</span>
                  {summary && <span className="mt-0.5 block text-helper text-neutral-700">{summary}</span>}
                  {/* Phones: who and on what, under the action. */}
                  <span className="mt-0.5 block text-helper text-neutral-600 md:hidden">
                    {[`${auditActor(e.actor_role)}${actorId(e) ? ` ${actorId(e)}` : ""}`, e.ip_address, auditEntityLabel(e)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td className={cn(td, "hidden md:table-cell")}>
                  <Record entry={e} />
                </td>
                <td className={cn(td, "text-right")}>
                  <button
                    type="button"
                    onClick={() => toggle(e.id)}
                    aria-expanded={expanded}
                    aria-controls={expanded ? detailId : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary-light hover:text-primary-dark",
                      focusRing,
                    )}
                  >
                    {expanded ? "Hide" : "View"}{" "}
                    <span className="sr-only">
                      details: {label}
                      {e.created_at ? `, ${formatReviewDate(e.created_at)} ${timeOfDay(e.created_at)}` : ""}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                  </button>
                </td>
              </tr>
              {expanded && (
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <td colSpan={6} className="px-4 py-4">
                    <AuditDetail id={detailId} entry={e} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

// Everything one entry carries.
function AuditDetail({ id, entry }: { id: string; entry: AuditLogItem }) {
  const changes = auditChanges(entry.details);
  const rows = auditDetailRows(entry.details);
  const fact = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="break-words text-neutral-900">{value}</dd>
    </div>
  );

  return (
    <div id={id} className="flex flex-col gap-4">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {fact("Recorded", auditExactTime(entry.created_at) ?? "Time not recorded")}
        {fact("Actor", `${auditActor(entry.actor_role)}${entry.actor_id ? ` · user #${entry.actor_id}` : ""}`)}
        {fact("IP address", entry.ip_address ?? "Not recorded")}
        {fact(
          "Action",
          <>
            {auditLabel(entry.action)} <code className="ml-1 rounded bg-white px-1 py-0.5 text-xs text-neutral-600">{entry.action}</code>
          </>,
        )}
        {fact("Record", <Record entry={entry} />)}
        {fact("Entry", `#${entry.id}`)}
      </dl>

      {changes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Before and after</h4>
          <table className="mt-1.5 w-full max-w-2xl text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-600">
                <th scope="col" className="py-1 pr-4 font-medium">Field</th>
                <th scope="col" className="py-1 pr-4 font-medium">Before</th>
                <th scope="col" className="py-1 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.field} className="border-b border-neutral-100">
                  <td className="py-1.5 pr-4 text-neutral-700">{c.field}</td>
                  <td className="break-all py-1.5 pr-4 text-neutral-900">{c.before}</td>
                  <td className="break-all py-1.5 font-medium text-neutral-900">{c.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recorded details</h4>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-neutral-600">{k}</dt>
                <dd className="break-all text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
