import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewChecklist, ReviewChecklistItem } from "@/lib/types";

const updateChecklistItem = vi.fn();
const requestMoreInformation = vi.fn();
vi.mock("@/lib/actions/checklist", () => ({ updateChecklistItem: (...a: unknown[]) => updateChecklistItem(...a) }));
vi.mock("@/lib/actions/information-requests", () => ({ requestMoreInformation: (...a: unknown[]) => requestMoreInformation(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));

import { VerificationChecklist, type ChecklistVariant } from "./VerificationChecklist";
import { RequestInformationForm } from "./RequestInformationForm";

function item(item_type: string, label: string, overrides: Partial<ReviewChecklistItem> = {}): ReviewChecklistItem {
  return { item_type, label, required: true, status: "pending", note: null, checked_by_name: null, checked_at: null, customer_verification_id: null, evidence: null, ...overrides };
}

function checklist(items: ReviewChecklistItem[]): ReviewChecklist {
  const required = items.filter((i) => i.required);
  const done = required.filter((i) => i.status === "verified" || i.status === "not_applicable");
  const blocking = items.filter((i) => (i.required && !(i.status === "verified" || i.status === "not_applicable")) || i.status === "failed");
  return {
    started: true,
    items,
    summary: {
      required: required.length,
      required_complete: done.length,
      failed: items.filter((i) => i.status === "failed").length,
      blocking_items: blocking.map((i) => i.item_type),
      ready_for_approval_recommendation: blocking.length === 0,
    },
  };
}

const initial = checklist([
  item("age_18_plus", "Age 18+ verified"),
  item("valid_id", "Valid ID checked", { status: "verified", evidence: { id_document_id: 41, id_expiry_date: "2030-01-31" }, checked_by_name: "Olive Officer", checked_at: "2026-09-29T02:00:00Z" }),
  item("contact_details", "Contact details checked", { status: "failed", note: "Phone disconnected." }),
  item("employment", "Employment checked", { status: "not_applicable", note: "Retired." }),
  item("proof_of_income", "Proof of income checked", { required: false }),
]);

const idDocuments = [{ id: 41, label: "Passport #41" }];
const row = (label: string) => screen.getByRole("radiogroup", { name: `${label} status` }).closest("li")!;

function renderCompact(props: Partial<Parameters<typeof VerificationChecklist>[0]> = {}) {
  return render(
    <VerificationChecklist
      applicationId={8}
      initial={initial}
      editable
      lockedReason="Locked."
      idDocuments={idDocuments}
      variant="compact"
      {...props}
    />,
  );
}

const savedChecklist = (status: ReviewChecklistItem["status"], key: string, extra: Partial<ReviewChecklistItem> = {}) =>
  checklist(initial.items.map((i) => (i.item_type === key ? { ...i, status, checked_by_name: "Olive Officer", ...extra } : i)));

describe("compact verification checklist", () => {
  beforeEach(() => {
    updateChecklistItem.mockReset();
    requestMoreInformation.mockReset();
  });

  it("renders every check from the data, each read as label, state and requirement", () => {
    renderCompact();
    expect(screen.getAllByRole("radiogroup")).toHaveLength(5);
    expect(within(row("Valid ID checked")).getByText(/^Valid ID checked/)).toHaveTextContent("Valid ID checked: Verified, required");
    expect(within(row("Proof of income checked")).getByText(/^Proof of income checked/)).toHaveTextContent(
      "Proof of income checked: Not checked yet, optional",
    );
    // Visible tag and state in words, not colour alone.
    expect(within(row("Proof of income checked")).getByText("Optional")).toBeInTheDocument();
    expect(within(row("Contact details checked")).getByText("Problem found")).toBeInTheDocument();
    // Evidence and who checked it, on one secondary line.
    expect(within(row("Valid ID checked")).getByText(/^Passport #41 · expires Jan 31, 2030 · Verified by Olive Officer, /)).toBeInTheDocument();
  });

  it("sums the checks up at the top", () => {
    renderCompact();
    expect(
      screen.getByText("4 required · 1 verified · 1 problem · 2 not checked yet · 1 N/A. Each check saves on its own."),
    ).toBeInTheDocument();
    expect(screen.getByText("2 checks outstanding")).toBeInTheDocument();
  });

  it("offers all four states as one radio group per check, operable from the keyboard", async () => {
    const user = userEvent.setup();
    renderCompact();
    const group = within(row("Age 18+ verified"));
    expect(group.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Verified", "Problem", "N/A", "Unchecked"]);
    // One tab stop: the checked radio.
    expect(group.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([-1, -1, -1, 0]);
    group.getByRole("radio", { name: "Unchecked" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(group.getByRole("radio", { name: "N/A" })).toHaveAttribute("aria-checked", "true");
    expect(group.getByRole("radio", { name: "N/A" })).toHaveFocus();
    expect(group.getByText("Note (required)")).toBeInTheDocument();
  });

  it("shows saved notes, and makes the note prominent on a problem", () => {
    renderCompact();
    expect(within(row("Contact details checked")).getByText("“Phone disconnected.”")).toBeInTheDocument();
    expect(within(row("Contact details checked")).getByRole("button", { name: "Edit note" })).toHaveClass("border");
    expect(within(row("Proof of income checked")).getByRole("button", { name: "Add note" })).not.toHaveClass("border");
  });

  it("saves one check on its own, says Saving then Saved, and keeps another check's draft", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    updateChecklistItem.mockReturnValue(new Promise((r) => (resolve = r)));
    renderCompact();

    await user.click(within(row("Proof of income checked")).getByRole("radio", { name: "Problem" }));
    await user.type(within(row("Proof of income checked")).getByRole("textbox"), "Payslip unreadable.");

    const emp = row("Employment checked");
    await user.click(within(emp).getByRole("radio", { name: "Verified" }));
    await user.click(within(emp).getByRole("button", { name: "Save" }));
    expect(within(emp).getByRole("status")).toHaveTextContent("Saving…");
    resolve({ ok: true, checklist: savedChecklist("verified", "employment", { note: "Retired." }) });
    expect(await within(row("Employment checked")).findByText("Saved")).toBeInTheDocument();

    expect(within(row("Proof of income checked")).getByRole("textbox")).toHaveValue("Payslip unreadable.");
    expect(within(row("Proof of income checked")).getByText("Unsaved")).toBeInTheDocument();
  });

  it("still requires a note for a problem before calling the backend", async () => {
    const user = userEvent.setup();
    renderCompact();
    const r = row("Age 18+ verified");
    await user.click(within(r).getByRole("radio", { name: "Problem" }));
    await user.click(within(r).getByRole("button", { name: "Save" }));
    expect(within(r).getByRole("alert")).toHaveTextContent("Add a note saying what the problem is.");
    expect(updateChecklistItem).not.toHaveBeenCalled();
  });

  it("shows an error, keeps the draft and lets the officer save again when the server can't be reached", async () => {
    const user = userEvent.setup();
    updateChecklistItem.mockRejectedValue(new TypeError("Failed to fetch"));
    renderCompact();
    const r = row("Proof of income checked");
    await user.click(within(r).getByRole("radio", { name: "Problem" }));
    await user.type(within(r).getByRole("textbox"), "Payslip unreadable.");
    await user.click(within(r).getByRole("button", { name: "Save" }));
    expect(await within(r).findByRole("alert")).toHaveTextContent("Couldn't reach the server");
    expect(within(r).getByRole("button", { name: "Save" })).toBeEnabled();
    expect(within(r).getByRole("textbox")).toHaveValue("Payslip unreadable.");
  });

  it("filters to the checks needing attention without losing drafts", async () => {
    const user = userEvent.setup();
    renderCompact();
    await user.click(within(row("Employment checked")).getByRole("button", { name: "Edit note" }));
    await user.type(within(row("Employment checked")).getByRole("textbox"), " Pension only.");

    // Blocking or a problem: the unchecked required one and the problem. The
    // optional, unchecked one doesn't hold anything up.
    await user.click(screen.getByRole("button", { name: "Needs attention (2)" }));
    expect(screen.getByRole("button", { name: "Needs attention (2)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("radiogroup").map((g) => g.getAttribute("aria-label"))).toEqual([
      "Age 18+ verified status",
      "Contact details checked status",
    ]);

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getAllByRole("radiogroup")).toHaveLength(5);
    expect(within(row("Employment checked")).getByRole("textbox")).toHaveValue("Retired. Pension only.");
  });

  it("is read-only with the reason when the viewer can't edit", () => {
    renderCompact({ editable: false, lockedReason: "Assigned to Oscar Other. Only they or an administrator can update these checks." });
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /note/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Assigned to Oscar Other/)).toBeInTheDocument();
    expect(screen.getByText("“Phone disconnected.”")).toBeInTheDocument();
  });

  it("opens the request-more-information panel from its header and focuses the first field", async () => {
    const user = userEvent.setup();
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <>
        <VerificationChecklist
          applicationId={8}
          initial={initial}
          editable
          lockedReason="Locked."
          variant="compact"
          requestInformationTargetId="request-information"
        />
        <RequestInformationForm applicationId={8} id="request-information" />
      </>,
    );
    expect(screen.queryByLabelText("Request type")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Request more information" }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByLabelText("Request type")).toHaveFocus();
  });

  it("has no request button when requesting isn't offered", () => {
    renderCompact();
    expect(screen.queryByRole("button", { name: "Request more information" })).not.toBeInTheDocument();
  });
});

// The same interactions must send exactly the same saves in either layout.
describe.each<ChecklistVariant>(["default", "compact"])("saves sent by the %s layout", (variant) => {
  it("match the other layout's for the same interactions", async () => {
    const user = userEvent.setup();
    updateChecklistItem.mockReset();
    updateChecklistItem.mockImplementation(async (_id: number, key: string, status: ReviewChecklistItem["status"], note: string) => ({
      ok: true,
      checklist: savedChecklist(status, key, { note: note.trim() || null }),
    }));
    render(<VerificationChecklist applicationId={8} initial={initial} editable lockedReason="L" idDocuments={idDocuments} variant={variant} />);

    const age = row("Age 18+ verified");
    await user.click(within(age).getByRole("radio", { name: "Verified" }));
    await user.type(within(age).getByLabelText(/Date of birth on the ID/), "1990-05-01");
    await user.click(within(age).getByRole("button", { name: "Save" }));
    await within(row("Age 18+ verified")).findByText("Saved");

    const contact = row("Contact details checked");
    await user.click(within(contact).getByRole("radio", { name: "Unchecked" }));
    await user.click(within(contact).getByRole("button", { name: "Save" }));
    await within(row("Contact details checked")).findByText("Saved");

    const income = row("Proof of income checked");
    await user.click(within(income).getByRole("radio", { name: "N/A" }));
    await user.type(within(income).getByRole("textbox"), "Under the threshold.");
    await user.click(within(income).getByRole("button", { name: "Save" }));
    await within(row("Proof of income checked")).findByText("Saved");

    expect(updateChecklistItem.mock.calls).toEqual([
      [8, "age_18_plus", "verified", "", { date_of_birth: "1990-05-01" }],
      [8, "contact_details", "pending", "Phone disconnected.", undefined],
      [8, "proof_of_income", "not_applicable", "Under the threshold.", undefined],
    ]);
  });
});
