import { ChevronRight, FileText } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { CompactEmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TabLink } from "@/components/ui/TabLink";
import { DocumentViewButton } from "@/components/staff/review/DocumentViewButton";
import { documentTypeLabel, formatReviewDateTime } from "@/lib/application-review";
import { awaitedDocumentTypes, documentProvenance, replacementOf, type DocumentProvenance } from "@/lib/checklist";
import { ID_DOCUMENT_TYPES } from "@/lib/loan-wizard";
import { statusPresentation } from "@/lib/status-presentation";
import { cn } from "@/lib/utils";
import { sectionHeading, table, tableWrap, td, th } from "./table";
import type { DocumentType, Referee, ReviewChecklistItem, ReviewDocument, ReviewInformationRequest } from "@/lib/types";

interface DocumentsTabProps {
  documents: ReviewDocument[];
  earlierVersions: ReviewDocument[] | null; // null = history couldn't be loaded
  referees: Referee[];
  checklist: { started: boolean; items: ReviewChecklistItem[] };
  informationRequests: ReviewInformationRequest[];
  verifiedIdDocumentId: number | null;
}

// Earlier versions are listed open when there are this many or fewer.
const HISTORY_OPEN_MAX = 3;

function idTypeLabel(type: string | null): string {
  if (!type) return "ID type not recorded";
  return ID_DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

// "Passport #41" / "#55": what identifies a file - the backend sends no
// file name (the storage path is deliberately never shown).
function documentName(doc: ReviewDocument): string {
  return doc.document_type === "id_verification" ? `${idTypeLabel(doc.id_document_type)} #${doc.id}` : `#${doc.id}`;
}

// The verification check that covers a group of documents, as a badge in
// words with a jump to it on the Verification tab.
function CheckState({ item, started }: { item: ReviewChecklistItem | undefined; started: boolean }) {
  if (!started || !item) {
    return <span className="text-xs text-neutral-500">Checks start when claimed</span>;
  }
  const p = statusPresentation("checklist", item.status);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <StatusBadge tone={p.tone} icon={p.icon}>
        {item.label}: {p.label}
      </StatusBadge>
      <TabLink tab="verification" className="inline-flex items-center gap-0.5 text-xs">
        Go to check
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </TabLink>
    </span>
  );
}

function ProvenanceLine({ p }: { p: DocumentProvenance }) {
  return (
    <span className="mt-0.5 block text-xs text-primary-dark">
      Provided in response to an information request{p.respondedAt ? ` (${formatReviewDateTime(p.respondedAt)})` : ""}: &ldquo;
      {p.reason}&rdquo;
    </span>
  );
}

function DocumentTable({
  docs,
  provenance,
  verifiedIdDocumentId,
  caption,
}: {
  docs: ReviewDocument[];
  provenance: Map<number, DocumentProvenance>;
  verifiedIdDocumentId: number | null;
  caption: string;
}) {
  return (
    <div className={tableWrap}>
      <table className={table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Type
            </th>
            <th scope="col" className={th}>
              Document
            </th>
            <th scope="col" className={th}>
              Uploaded
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              <span className="sr-only">View</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td className={cn(td, "whitespace-nowrap")}>
                <span className="inline-flex items-center gap-2 font-medium text-neutral-900">
                  <FileText className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  {documentTypeLabel(d.document_type)}
                </span>
              </td>
              <td className={td}>
                <span className="text-neutral-900">{documentName(d)}</span>
                {d.id === verifiedIdDocumentId && (
                  <span className="mt-0.5 block text-xs font-medium text-success">
                    Used for the customer&apos;s current verification
                  </span>
                )}
                {provenance.get(d.id) && <ProvenanceLine p={provenance.get(d.id)!} />}
              </td>
              <td className={cn(td, "whitespace-nowrap text-neutral-700")}>{formatReviewDateTime(d.uploaded_at) ?? "—"}</td>
              <td className={cn(td, "text-right")}>
                <DocumentViewButton documentId={d.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The officer's Documents tab: the application's files grouped by what they
// prove, each group with the verification check that covers it, then the
// referees and the replaced versions. Everything the original documents
// panel showed (the administrator still uses that panel) - only laid out as
// rows. Opening a file is the same DocumentViewButton: a signed URL fetched
// on click, in a new tab, logged by the backend.
export function DocumentsTab({
  documents,
  earlierVersions,
  referees,
  checklist,
  informationRequests,
  verifiedIdDocumentId,
}: DocumentsTabProps) {
  const check = (key: string) => checklist.items.find((i) => i.item_type === key);
  const allKnown = [...documents, ...(earlierVersions ?? [])];
  const provenance = documentProvenance(informationRequests, new Map(allKnown.map((d) => [d.id, d.document_type])));
  const awaited = awaitedDocumentTypes(informationRequests);
  const incomeCheck = check("proof_of_income");
  // Whether proof of income is required is the backend's checklist rule.
  const incomeRequired = incomeCheck?.required ?? null;

  const groups: {
    key: string;
    title: string;
    docs: ReviewDocument[];
    awaitedType?: DocumentType;
    checkCell: React.ReactNode;
    empty: string;
  }[] = [
    {
      key: "id",
      title: "ID document",
      docs: documents.filter((d) => d.document_type === "id_verification"),
      awaitedType: "id_verification",
      checkCell: <CheckState item={check("valid_id")} started={checklist.started} />,
      empty: "No ID document on file.",
    },
    {
      key: "income",
      title: "Proof of income",
      docs: documents.filter((d) => d.document_type === "proof_of_income"),
      awaitedType: "proof_of_income",
      checkCell:
        incomeRequired === false ? (
          <span className="text-xs text-neutral-600">Not required for this amount</span>
        ) : (
          <CheckState item={incomeCheck} started={checklist.started} />
        ),
      empty: incomeRequired ? "Required, but none uploaded." : "None uploaded.",
    },
    {
      key: "other",
      title: "Other supporting documents",
      docs: documents.filter((d) => d.document_type !== "id_verification" && d.document_type !== "proof_of_income"),
      checkCell: null,
      empty: "None uploaded.",
    },
  ];

  const historyOpen = (earlierVersions?.length ?? 0) <= HISTORY_OPEN_MAX;

  return (
    <Card className="flex flex-col gap-6">
      <CardTitle>Documents &amp; referees</CardTitle>

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`docs-${g.key}`} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 id={`docs-${g.key}`} className={sectionHeading}>
              {g.title} <span className="font-sans text-sm font-normal text-neutral-500">({g.docs.length})</span>
            </h3>
            {g.checkCell}
          </div>
          {g.awaitedType && awaited.has(g.awaitedType) && (
            <p className="text-xs font-medium text-amber-800">
              Requested from the customer in an open information request - waiting on their upload.
            </p>
          )}
          {g.docs.length === 0 ? (
            <CompactEmptyState>{g.empty}</CompactEmptyState>
          ) : (
            <DocumentTable
              docs={g.docs}
              provenance={provenance}
              verifiedIdDocumentId={verifiedIdDocumentId}
              caption={g.title}
            />
          )}
        </section>
      ))}

      <section aria-labelledby="docs-referees" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 id="docs-referees" className={sectionHeading}>
            Referees <span className="font-sans text-sm font-normal text-neutral-500">({referees.length})</span>
          </h3>
          <CheckState item={check("referee")} started={checklist.started} />
        </div>
        {referees.length === 0 ? (
          <CompactEmptyState>No referees on this application.</CompactEmptyState>
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <caption className="sr-only">Referees</caption>
              <thead>
                <tr>
                  {["Name", "Relationship", "Mobile", "Employer"].map((h) => (
                    <th key={h} scope="col" className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {referees.map((r) => (
                  <tr key={r.id}>
                    <td className={cn(td, "font-medium text-neutral-900")}>{r.full_name}</td>
                    <td className={cn(td, "text-neutral-700")}>{r.relationship}</td>
                    <td className={cn(td, "whitespace-nowrap tabular-nums text-neutral-700")}>
                      {r.mobile_number || <span className="italic text-neutral-500">Not provided</span>}
                    </td>
                    <td className={cn(td, "text-neutral-700")}>
                      {r.employer_name || <span className="italic text-neutral-500">Not provided</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="docs-history" className="flex flex-col gap-2 border-t border-neutral-100 pt-5">
        <h3 id="docs-history" className={sectionHeading}>
          Document history
        </h3>
        {earlierVersions === null ? (
          <CompactEmptyState>Couldn&apos;t load earlier versions. Refresh to try again.</CompactEmptyState>
        ) : earlierVersions.length === 0 ? (
          <CompactEmptyState>No earlier versions.</CompactEmptyState>
        ) : (
          <details open={historyOpen} className="group rounded-lg border border-neutral-200">
            <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
              {earlierVersions.length === 1 ? "1 earlier version" : `${earlierVersions.length} earlier versions`}
              <span className="font-normal text-neutral-600">- replaced by a newer upload, kept for the record</span>
            </summary>
            <div className={cn(tableWrap, "px-3 pb-2")}>
              <table className={table}>
                <caption className="sr-only">Earlier versions</caption>
                <thead>
                  <tr>
                    {["Type", "Document", "Uploaded", "Replaced by"].map((h) => (
                      <th key={h} scope="col" className={th}>
                        {h}
                      </th>
                    ))}
                    <th scope="col" className={cn(th, "text-right")}>
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {earlierVersions.map((d) => {
                    const replacement = replacementOf(d, allKnown);
                    const viaRequest = d.superseded_by_id !== null && provenance.has(d.superseded_by_id);
                    return (
                      <tr key={d.id}>
                        <td className={cn(td, "whitespace-nowrap font-medium text-neutral-900")}>
                          {documentTypeLabel(d.document_type)}
                        </td>
                        <td className={td}>
                          {documentName(d)}
                          {provenance.get(d.id) && <ProvenanceLine p={provenance.get(d.id)!} />}
                        </td>
                        <td className={cn(td, "whitespace-nowrap text-neutral-700")}>
                          {formatReviewDateTime(d.uploaded_at) ?? "—"}
                        </td>
                        <td className={cn(td, "text-neutral-700")}>
                          {replacement ? `#${replacement.id}` : "a newer upload"}
                          {replacement?.uploaded_at ? ` on ${formatReviewDateTime(replacement.uploaded_at)}` : ""}
                          {viaRequest && <span className="block text-xs">in response to an information request</span>}
                        </td>
                        <td className={cn(td, "text-right")}>
                          <DocumentViewButton documentId={d.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>
    </Card>
  );
}
