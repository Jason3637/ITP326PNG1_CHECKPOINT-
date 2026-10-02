import { FileText } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { DocumentViewButton } from "./DocumentViewButton";
import { documentTypeLabel, formatReviewDateTime } from "@/lib/application-review";
import {
  CHECKLIST_STATUS_LABELS,
  awaitedDocumentTypes,
  documentProvenance,
  replacementOf,
  type DocumentProvenance,
} from "@/lib/checklist";
import type {
  ChecklistItemStatus,
  DocumentType,
  Referee,
  ReviewChecklistItem,
  ReviewDocument,
  ReviewInformationRequest,
} from "@/lib/types";

const CHECK_VARIANT: Record<ChecklistItemStatus, NonNullable<BadgeProps["variant"]>> = {
  pending: "neutral",
  verified: "success",
  failed: "danger",
  not_applicable: "neutral",
};

function CheckStatus({ item, started }: { item: ReviewChecklistItem | undefined; started: boolean }) {
  // The checklist only exists once an officer claims the application.
  if (!started || !item) return <Badge variant="neutral">Checks start when claimed</Badge>;
  return (
    <Badge variant={CHECK_VARIANT[item.status] ?? "neutral"}>
      {`${item.label}: ${CHECKLIST_STATUS_LABELS[item.status] ?? "Not checked yet"}`}
    </Badge>
  );
}

function ProvenanceLine({ p }: { p: DocumentProvenance }) {
  return (
    <p className="mt-0.5 text-xs text-primary-dark">
      Provided in response to an information request{p.respondedAt ? ` (${formatReviewDateTime(p.respondedAt)})` : ""}
      : &ldquo;{p.reason}&rdquo;
    </p>
  );
}

interface DocumentRowProps {
  doc: ReviewDocument;
  verifiedNote?: boolean;
  provenance?: DocumentProvenance;
  replacedBy?: { doc: ReviewDocument | null; viaRequest: boolean } | null;
}

function DocumentRow({ doc, verifiedNote, provenance, replacedBy }: DocumentRowProps) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">
            {documentTypeLabel(doc.document_type)} <span className="font-normal text-neutral-500">#{doc.id}</span>
          </p>
          <p className="text-xs text-neutral-600">Uploaded {formatReviewDateTime(doc.uploaded_at) ?? "—"}</p>
          {verifiedNote && (
            <p className="mt-0.5 text-xs font-medium text-success">Used for the customer&apos;s current verification</p>
          )}
          {provenance && <ProvenanceLine p={provenance} />}
          {replacedBy && (
            <p className="mt-0.5 text-xs text-neutral-600">
              Replaced by {replacedBy.doc ? `#${replacedBy.doc.id}` : "a newer upload"}
              {replacedBy.doc?.uploaded_at ? ` on ${formatReviewDateTime(replacedBy.doc.uploaded_at)}` : ""}
              {replacedBy.viaRequest ? " - in response to an information request" : ""}
            </p>
          )}
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
  informationRequests: ReviewInformationRequest[];
  verifiedIdDocumentId: number | null;
}

// Document status = the checklist result for the check that covers it,
// plus where each file came from: the original application, or a
// request-more-information round (the backend's own
// InformationResponse.provided_document_ids link). Replaced files stay
// listed under Document history with what replaced them.
export function DocumentsPanel({
  documents,
  earlierVersions,
  referees,
  checklist,
  informationRequests,
  verifiedIdDocumentId,
}: DocumentsPanelProps) {
  const check = (key: string) => checklist.items.find((i) => i.item_type === key);
  const provenance = documentProvenance(informationRequests);
  const awaited = awaitedDocumentTypes(informationRequests);
  const allKnown = [...documents, ...(earlierVersions ?? [])];

  const idDocs = documents.filter((d) => d.document_type === "id_verification");
  const incomeDocs = documents.filter((d) => d.document_type === "proof_of_income");
  const otherDocs = documents.filter((d) => d.document_type !== "id_verification" && d.document_type !== "proof_of_income");
  const incomeCheck = check("proof_of_income");
  // Whether proof of income is required comes from the backend's own
  // checklist rule (amount threshold), never re-derived here.
  const incomeRequired = incomeCheck?.required ?? null;

  const row = (d: ReviewDocument) => (
    <DocumentRow
      key={d.id}
      doc={d}
      verifiedNote={d.id === verifiedIdDocumentId}
      provenance={provenance.get(d.id)}
    />
  );

  const awaitedNote = (type: DocumentType) =>
    awaited.has(type) && (
      <p className="mt-2 text-xs font-medium text-amber-800">
        Requested from the customer in an open information request - waiting on their upload.
      </p>
    );

  return (
    <Card>
      <CardTitle>Documents &amp; referees</CardTitle>

      <section className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">ID document</h3>
          <CheckStatus item={check("valid_id")} started={checklist.started} />
        </div>
        {awaitedNote("id_verification")}
        {idDocs.length === 0 ? (
          <p className="mt-2 text-sm italic text-neutral-500">No ID document on file.</p>
        ) : (
          <ul className="mt-1 divide-y divide-neutral-100">{idDocs.map(row)}</ul>
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
        {awaitedNote("proof_of_income")}
        {incomeDocs.length === 0 ? (
          <p className="mt-2 text-sm italic text-neutral-500">
            {incomeRequired ? "Required, but none uploaded." : "None uploaded."}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-neutral-100">{incomeDocs.map(row)}</ul>
        )}
      </section>

      {otherDocs.length > 0 && (
        <section className="mt-5">
          <h3 className="text-sm font-semibold text-neutral-900">Other documents</h3>
          <ul className="mt-1 divide-y divide-neutral-100">{otherDocs.map(row)}</ul>
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
              {earlierVersions.map((d) => {
                const replacement = replacementOf(d, allKnown);
                return (
                  <DocumentRow
                    key={d.id}
                    doc={d}
                    provenance={provenance.get(d.id)}
                    replacedBy={{
                      doc: replacement,
                      viaRequest: d.superseded_by_id !== null && provenance.has(d.superseded_by_id),
                    }}
                  />
                );
              })}
            </ul>
          </>
        )}
      </section>
    </Card>
  );
}
