import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewChecklist, ReviewChecklistItem } from "@/lib/types";

const updateChecklistItem = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/actions/checklist", () => ({ updateChecklistItem: (...a: unknown[]) => updateChecklistItem(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { VerificationChecklist } from "./VerificationChecklist";

function item(item_type: string, label: string, overrides: Partial<ReviewChecklistItem> = {}): ReviewChecklistItem {
  return { item_type, label, required: true, status: "pending", note: null, checked_by_name: null, checked_at: null, ...overrides };
}

function checklist(items: ReviewChecklistItem[]): ReviewChecklist {
  const required = items.filter((i) => i.required);
  const done = required.filter((i) => i.status === "verified" || i.status === "not_applicable");
  const blocking = items.filter(
    (i) => (i.required && !(i.status === "verified" || i.status === "not_applicable")) || i.status === "failed",
  );
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
  item("valid_id", "Valid ID checked"),
  item("proof_of_income", "Proof of income checked", { required: false }),
]);

function row(label: string) {
  return screen.getByText(label).closest("li")!;
}

describe("VerificationChecklist", () => {
  beforeEach(() => {
    updateChecklistItem.mockReset();
    refresh.mockReset();
  });

  it("renders every item individually, with required/optional from the backend", () => {
    render(<VerificationChecklist applicationId={8} initial={initial} editable lockedReason="" />);
    expect(screen.getAllByRole("radiogroup")).toHaveLength(3);
    expect(within(row("Proof of income checked")).getByText("Optional for this application")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 required checks done. Each check saves on its own.")).toBeInTheDocument();
  });

  it("saves one item on its own and keeps another item's unsaved draft", async () => {
    const user = userEvent.setup();
    const after = checklist([
      item("age_18_plus", "Age 18+ verified", {
        status: "verified",
        note: "DOB on NID card.",
        checked_by_name: "Olive Officer",
        checked_at: "2026-09-28T00:00:00Z",
      }),
      item("valid_id", "Valid ID checked"),
      item("proof_of_income", "Proof of income checked", { required: false }),
    ]);
    updateChecklistItem.mockResolvedValue({ ok: true, checklist: after });
    render(<VerificationChecklist applicationId={8} initial={initial} editable lockedReason="" />);

    // Start a draft on Valid ID, then save Age 18+ separately.
    await user.click(within(row("Valid ID checked")).getByRole("radio", { name: "Problem" }));
    const age = row("Age 18+ verified");
    await user.click(within(age).getByRole("radio", { name: "Verified" }));
    await user.type(within(age).getByRole("textbox"), "DOB on NID card.");
    await user.click(within(age).getByRole("button", { name: "Save" }));

    expect(updateChecklistItem).toHaveBeenCalledTimes(1);
    expect(updateChecklistItem).toHaveBeenCalledWith(8, "age_18_plus", "verified", "DOB on NID card.");
    expect(within(row("Age 18+ verified")).getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText(/Verified by Olive Officer/)).toBeInTheDocument();
    expect(screen.getByText("1 of 2 required checks done. Each check saves on its own.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    // The other item's unsaved choice survived the save.
    expect(within(row("Valid ID checked")).getByRole("radio", { name: "Problem" })).toHaveAttribute("aria-checked", "true");
    expect(within(row("Valid ID checked")).getByText("Unsaved")).toBeInTheDocument();
  });

  it("requires a note before saving a problem, without calling the backend", async () => {
    const user = userEvent.setup();
    render(<VerificationChecklist applicationId={8} initial={initial} editable lockedReason="" />);
    const id = row("Valid ID checked");
    await user.click(within(id).getByRole("radio", { name: "Problem" }));
    expect(within(id).getByText("Note (required)")).toBeInTheDocument();
    await user.click(within(id).getByRole("button", { name: "Save" }));
    expect(within(id).getByRole("alert")).toHaveTextContent("Add a note saying what the problem is.");
    expect(updateChecklistItem).not.toHaveBeenCalled();
  });

  it("shows a save failure on that item only and keeps the draft", async () => {
    const user = userEvent.setup();
    updateChecklistItem.mockResolvedValue({ ok: false, error: "Only the assigned officer or an administrator can update these checks." });
    render(<VerificationChecklist applicationId={8} initial={initial} editable lockedReason="" />);
    const age = row("Age 18+ verified");
    await user.click(within(age).getByRole("radio", { name: "Verified" }));
    await user.click(within(age).getByRole("button", { name: "Save" }));
    expect(within(age).getByRole("alert")).toHaveTextContent(/assigned officer/);
    expect(within(age).getByRole("radio", { name: "Verified" })).toHaveAttribute("aria-checked", "true");
    expect(within(row("Valid ID checked")).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is read-only with the reason when the viewer can't edit", () => {
    const done = checklist([
      item("age_18_plus", "Age 18+ verified", { status: "failed", note: "Under 18 per NID." }),
    ]);
    render(
      <VerificationChecklist
        applicationId={8}
        initial={done}
        editable={false}
        lockedReason="Assigned to Oscar Other. Only they or an administrator can update these checks."
      />,
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByText(/Assigned to Oscar Other/)).toBeInTheDocument();
    expect(screen.getByText("“Under 18 per NID.”")).toBeInTheDocument();
  });
});
