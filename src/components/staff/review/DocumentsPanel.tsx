import { FileText } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { DocumentViewButton } from "./DocumentViewButton";
import { documentTypeLabel, formatReviewDateTime } from "@/lib/application-review";
import type { ChecklistItemStatus, Referee, ReviewChecklistItem, ReviewDocument } from "@/lib/types";

const CHECK_STATUS: Record<ChecklistItemStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  pending: { label: "Not checked yet", variant: "neutral" },
  verified: { label: "Verified", variant: "success" },
  failed: { label: "Problem found", variant: "danger" },
  not_applicable: { label: "Not applicable", variant: "neutral" },
};

function CheckStatus({ item, started }: { item: ReviewChecklistItem | undefined; started: boolean }) {
  // The checklist only exists once an officer claims the application.
  if (!started || !item) return <Badge variant="neutral">Checks start when claimed</Badge>;
  const s = CHECK_STATUS[item.status] ?? CHECK_STATUS.pending;
  return <Badge variant={s.variant}>{`${item.label}: ${s.label}`}</Badge>;
}

function DocumentRow({ doc, badge }: { doc: ReviewDocument; badge?: string }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">
            {documentTypeLabel(doc.document_type)} <span className="font-normal text-neutral-500">#{doc.id}</span>
          </p>
          <p className="text-xs text-neutral-600">Uploaded {formatReviewDateTime(doc.uploaded_at) ?? "—"}</p>
          {badge && <p className="mt-0.5 text-xs font-medium text-success">{badge}</p>}
        </div>
      </div>
      <DocumentViewButton documentId={doc.id} />
    </li>
  );
}

interface DocumentsPanelProps {
  documents: ReviewDocument[];
  earlierVersions: ReviewDocument[] | null; // null = history couldn't be loaded
  referees: Referee[];
  checklist: { started: boolean; items: ReviewChecklistItem[] };
  verifiedIdDocumentId: number | null;
}

export function DocumentsPanel({
  documents,
  earlierVersions,
  referees,
  checklist,
  verifiedIdDocumentId,
}: DocumentsPanelProps) {
  const check = (key: string) => checklist.items.find((i) => i.item_type === key);
  const idDocs = documents.filter((d) => d.document_type === "id_verification");
  const incomeDocs = documents.filter((d) => d.document_type === "proof_of_income");
  const otherDocs = documents.filter((d) => d.document_type !== "id_verification" && d.document_type !== "proof_of_income");
  const incomeCheck = check("proof_of_income");
  // Whether proof of income is required comes from the backend's own
  // checklist rule (amount threshold), never re-derived here.
  const incomeRequired = incomeCheck?.required ?? null;

  return (
    <Card>
      <CardTitle>Documents &amp; referees</CardTitle>

      <section className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">ID document</h3>
          <CheckStatus item={check("valid_id")} started={checklist.started} />
        </div>
        {idDocs.length === 0 ? (
          <p className="mt-2 text-sm italic text-neutral-500">No ID document on file.</p>
        ) : (
          <ul className="mt-1 divide-y divide-neutral-100">
            {idDocs.map((d) => (
              <DocumentRow
                key={d.id}
                doc={d}
                badge={d.id === verifiedIdDocumentId ? "Used for the customer's current verification" : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Proof of income</h3>
          {incomeRequired === false ? (
            <Badge variant="neutral">Not required for this amount</Badge>
          ) : (
            <CheckStatus item={incomeCheck} started={checklist.started} />
          )}
        </div>
        {incomeDocs.length === 0 ? (
          <p className="mt-2 text-sm italic text-neutral-500">
            {incomeRequired ? "Required, but none uploaded." : "None uploaded."}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-neutral-100">
            {incomeDocs.map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </ul>
        )}
      </section>

      {otherDocs.length > 0 && (
        <section className="mt-5">
          <h3 className="text-sm font-semibold text-neutral-900">Other documents</h3>
          <ul className="mt-1 divide-y divide-neutral-100">
            {otherDocs.map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Referees</h3>
          <CheckStatus item={check("referee")} started={checklist.started} />
        </div>
        {referees.length === 0 ? (
          <p className="mt-2 text-sm italic text-neutral-500">No referees on this application.</p>
        ) : (
          <ul className="mt-1 divide-y divide-neutral-100">
            {referees.map((r) => (
              <li key={r.id} className="py-2.5 text-sm">
                <p className="font-medium text-neutral-900">{r.full_name}</p>
                <p className="text-neutral-600">
                  {r.relationship}
                  {r.mobile_number ? ` · ${r.mobile_number}` : ""}
                </p>
                <p className="text-xs text-neutral-600">Employer: {r.employer_name || "Not provided"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5 border-t border-neutral-100 pt-4">
        <h3 className="text-sm font-semibold text-neutral-900">Document history</h3>
        {earlierVersions === null ? (
          <p className="mt-2 text-sm text-neutral-600">Couldn&apos;t load earlier versions. Refresh to try again.</p>
        ) : earlierVersions.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No earlier versions.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-neutral-600">Replaced by a newer upload, kept for the record.</p>
            <ul className="mt-1 divide-y divide-neutral-100">
              {earlierVersions.map((d) => (
                <DocumentRow key={d.id} doc={d} />
              ))}
            </ul>
          </>
        )}
      </section>
    </Card>
  );
}
