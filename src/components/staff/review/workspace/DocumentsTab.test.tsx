import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The view button's server action imports server-only code.
vi.mock("@/lib/actions/staff-documents", () => ({ getStaffDocumentUrl: vi.fn() }));

import { DocumentsTab } from "./DocumentsTab";
import { TAB_SELECT_EVENT } from "@/components/ui/Tabs";
import type { ReviewChecklistItem, ReviewDocument, ReviewInformationRequest } from "@/lib/types";

const idDoc: ReviewDocument = {
  id: 31,
  loan_application_id: null,
  document_type: "id_verification",
  id_document_type: "national_id",
  uploaded_at: "2026-09-27T00:00:00Z",
  is_current: true,
  superseded_by_id: null,
  linked_to_this_application: false,
};
const referees = [
  { id: 1, full_name: "Maria Kaupa", relationship: "sibling", mobile_number: "+675 7123 4567", employer_name: "Air Niugini" },
  { id: 2, full_name: "Peter Wari", relationship: "colleague", mobile_number: "", employer_name: "" },
];
const items = (overrides: Partial<Record<string, Partial<ReviewChecklistItem>>> = {}): ReviewChecklistItem[] =>
  [
    { item_type: "valid_id", label: "Valid ID checked", required: true, status: "verified" as const },
    { item_type: "referee", label: "Referee checked", required: true, status: "pending" as const },
    { item_type: "proof_of_income", label: "Proof of income checked", required: false, status: "pending" as const },
  ].map((i) => ({ note: null, checked_by_name: null, checked_at: null, customer_verification_id: null, evidence: null, ...i, ...overrides[i.item_type] }));

const requestBase = {
  request_type: "document_expired" as const,
  required_information: null,
  internal_note: null,
  requested_by_name: "Olive Officer",
  cancelled_at: null,
  cancel_reason: null,
};

const section = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}`) });

describe("DocumentsTab", () => {
  it("groups the files, each group with the check that covers it, and marks the ID used for verification", () => {
    render(
      <DocumentsTab
        documents={[idDoc]}
        earlierVersions={[]}
        referees={referees}
        checklist={{ started: true, items: items() }}
        informationRequests={[]}
        verifiedIdDocumentId={31}
      />,
    );
    const id = within(section("ID document"));
    expect(id.getByText("Valid ID checked: Verified")).toBeInTheDocument();
    const row = within(id.getByRole("table", { name: "ID document" })).getAllByRole("row")[1];
    expect(within(row).getByText("ID document")).toBeInTheDocument();
    expect(within(row).getByText("National ID #31")).toBeInTheDocument();
    expect(within(row).getByText("Used for the customer's current verification")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(within(section("Proof of income")).getByText("Not required for this amount")).toBeInTheDocument();
    expect(within(section("Other supporting documents")).getByText("None uploaded.")).toBeInTheDocument();
    expect(within(section("Referees")).getByText("Referee checked: Not checked yet")).toBeInTheDocument();
  });

  it("lists the referees as rows, saying when a detail wasn't given", () => {
    render(
      <DocumentsTab documents={[]} earlierVersions={[]} referees={referees} checklist={{ started: true, items: items() }} informationRequests={[]} verifiedIdDocumentId={null} />,
    );
    const rows = within(screen.getByRole("table", { name: "Referees" })).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      "Maria Kaupasibling+675 7123 4567Air Niugini",
      "Peter WaricolleagueNot providedNot provided",
    ]);
  });

  it("uses the backend's rule for whether proof of income is required", () => {
    render(
      <DocumentsTab
        documents={[]}
        earlierVersions={[]}
        referees={[]}
        checklist={{ started: true, items: items({ proof_of_income: { required: true } }) }}
        informationRequests={[]}
        verifiedIdDocumentId={null}
      />,
    );
    expect(screen.getByText("Required, but none uploaded.")).toBeInTheDocument();
    expect(screen.getByText("No ID document on file.")).toBeInTheDocument();
    expect(screen.getByText("No referees on this application.")).toBeInTheDocument();
  });

  it("explains that checks start at claim time, and when history couldn't load", () => {
    render(
      <DocumentsTab documents={[idDoc]} earlierVersions={null} referees={[]} checklist={{ started: false, items: [] }} informationRequests={[]} verifiedIdDocumentId={null} />,
    );
    expect(screen.getAllByText("Checks start when claimed").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Go to check/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn't load earlier versions/)).toBeInTheDocument();
  });

  it("jumps to the Verification tab from a group's check", async () => {
    const onSelect = vi.fn();
    window.addEventListener(TAB_SELECT_EVENT, onSelect);
    render(
      <DocumentsTab documents={[idDoc]} earlierVersions={[]} referees={[]} checklist={{ started: true, items: items() }} informationRequests={[]} verifiedIdDocumentId={null} />,
    );
    const link = within(section("ID document")).getByRole("link", { name: "Go to check" });
    expect(link).toHaveAttribute("href", "?tab=verification");
    await userEvent.click(link);
    expect((onSelect.mock.calls[0][0] as CustomEvent).detail).toEqual({ tab: "verification" });
    window.removeEventListener(TAB_SELECT_EVENT, onSelect);
  });

  it("ties replaced documents to the information request that asked for them", () => {
    const oldPayslip: ReviewDocument = { ...idDoc, id: 40, loan_application_id: 12, document_type: "proof_of_income", id_document_type: null, is_current: false, superseded_by_id: 41 };
    const newPayslip: ReviewDocument = { ...oldPayslip, id: 41, is_current: true, superseded_by_id: null };
    const requests: ReviewInformationRequest[] = [
      {
        ...requestBase,
        id: 5,
        reason: "Your payslip is from 2024 - please upload a current one.",
        required_document_type: "proof_of_income",
        status: "responded",
        requested_at: "2026-09-20T00:00:00Z",
        response: { response_note: "Uploaded.", responded_at: "2026-09-21T00:00:00Z", field_changes: null, provided_document_ids: [41] },
      },
      {
        ...requestBase,
        id: 6,
        request_type: "document_unclear",
        reason: "Please upload a clearer ID.",
        required_document_type: "id_verification",
        status: "open",
        requested_at: "2026-09-22T00:00:00Z",
        response: null,
      },
    ];
    render(
      <DocumentsTab
        documents={[newPayslip]}
        earlierVersions={[oldPayslip]}
        referees={[]}
        checklist={{ started: true, items: items({ proof_of_income: { required: true } }) }}
        informationRequests={requests}
        verifiedIdDocumentId={null}
      />,
    );
    expect(screen.getByText(/Provided in response to an information request.*Your payslip is from 2024/)).toBeInTheDocument();
    const history = within(screen.getByRole("table", { name: "Earlier versions" }));
    const row = history.getAllByRole("row")[1];
    expect(row).toHaveTextContent(/#40/);
    expect(row).toHaveTextContent(/#41 on .*in response to an information request/);
    expect(within(row).getByRole("button", { name: "View" })).toBeInTheDocument();
    // Only the ID section is still waiting - the payslip request was answered.
    expect(screen.getAllByText(/waiting on their upload/)).toHaveLength(1);
  });

  it("keeps every earlier version, collapsed when there are more than three", () => {
    const versions = [50, 51, 52, 53].map((id) => ({ ...idDoc, id, is_current: false, superseded_by_id: 31 }));
    const { unmount } = render(
      <DocumentsTab documents={[idDoc]} earlierVersions={versions} referees={[]} checklist={{ started: true, items: items() }} informationRequests={[]} verifiedIdDocumentId={null} />,
    );
    const details = screen.getByText("4 earlier versions").closest("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getAllByRole("row", { hidden: true })).toHaveLength(5); // header + all four
    unmount();

    render(
      <DocumentsTab documents={[idDoc]} earlierVersions={versions.slice(0, 2)} referees={[]} checklist={{ started: true, items: items() }} informationRequests={[]} verifiedIdDocumentId={null} />,
    );
    expect(screen.getByText("2 earlier versions").closest("details")).toHaveAttribute("open");
  });
});
