import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CustomerInformationRequest, LoanApplication } from "@/lib/types";

const uploadLoanDocument = vi.fn();
const respondToActionRequired = vi.fn();
vi.mock("@/lib/actions/documents", () => ({ uploadLoanDocument: (...a: unknown[]) => uploadLoanDocument(...a) }));
vi.mock("@/app/(dashboard)/dashboard/applications/[applicationId]/respond/actions", () => ({
  respondToActionRequired: (...a: unknown[]) => respondToActionRequired(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { RespondForm } from "./RespondForm";

function request(overrides: Partial<CustomerInformationRequest>): CustomerInformationRequest {
  return {
    id: 1,
    request_type: "document_expired",
    reason: "Your payslip is from 2024. Please upload a current one.",
    required_document_type: "proof_of_income",
    required_information: null,
    status: "open",
    requested_at: "2026-09-25T00:00:00Z",
    cancelled_at: null,
    response: null,
    ...overrides,
  };
}

function application(requests: CustomerInformationRequest[]): LoanApplication {
  return {
    id: 16,
    status: "customer_action_required",
    action_required_note: requests.map((r) => r.reason).join("\n"),
    information_requests: requests,
  } as LoanApplication;
}

const open = [
  request({ id: 1 }),
  request({
    id: 2,
    request_type: "referee_unreachable",
    reason: "We couldn't reach your referee.",
    required_document_type: null,
    required_information: "Another phone number for Maria",
  }),
];

const pdf = () => new File(["%PDF"], "payslip.pdf", { type: "application/pdf" });

describe("RespondForm", () => {
  beforeEach(() => {
    uploadLoanDocument.mockReset();
    respondToActionRequired.mockReset();
  });

  it("shows each request's type, description and specific required items", () => {
    render(<RespondForm application={application(open)} />);
    expect(screen.getByText("Document has expired")).toBeInTheDocument();
    expect(screen.getByText("Referee couldn't be reached")).toBeInTheDocument();
    expect(screen.getByText("Upload: Proof of income")).toBeInTheDocument();
    expect(screen.getByText("Provide: Another phone number for Maria")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload your proof of income")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Your answer")).toHaveLength(2);
  });

  it("requires an answer for every request and the requested document", async () => {
    const user = userEvent.setup();
    render(<RespondForm application={application(open)} />);
    await user.click(screen.getByRole("button", { name: "Send response" }));
    expect(screen.getAllByText("Write a short answer to this request.")).toHaveLength(2);
    expect(screen.getByText("Upload your proof of income.")).toBeInTheDocument();
    expect(respondToActionRequired).not.toHaveBeenCalled();
  });

  it("uploads the requested document type and answers each request separately, on the same application", async () => {
    const user = userEvent.setup();
    uploadLoanDocument.mockResolvedValue({ ok: true, document: { id: 77 } });
    respondToActionRequired.mockResolvedValue({ ok: true, application: { id: 16 } });
    render(<RespondForm application={application(open)} />);

    const [first, second] = screen.getAllByRole("listitem").filter((li) => li.querySelector("textarea"));
    await user.type(within(first).getByLabelText("Your answer"), "September payslip attached.");
    await user.upload(within(first).getByLabelText("Upload your proof of income"), pdf());
    await user.type(within(second).getByLabelText("Your answer"), "Maria's other number is 7000 1111.");
    await user.click(screen.getByRole("button", { name: "Send response" }));

    const form = uploadLoanDocument.mock.calls[0][0] as FormData;
    expect(form.get("document_type")).toBe("proof_of_income");
    // Uploaded unlinked - the respond call links it to the application.
    expect(form.get("loan_application_id")).toBeNull();
    expect(respondToActionRequired).toHaveBeenCalledWith({
      applicationId: 16,
      responses: [
        { information_request_id: 1, response_note: "September payslip attached." },
        { information_request_id: 2, response_note: "Maria's other number is 7000 1111." },
      ],
      documentIds: [77],
    });
    expect(screen.getByText("Response submitted")).toBeInTheDocument();
  });

  it("doesn't upload the same file twice when retrying after a failed submit", async () => {
    const user = userEvent.setup();
    uploadLoanDocument.mockResolvedValue({ ok: true, document: { id: 77 } });
    respondToActionRequired
      .mockResolvedValueOnce({ ok: false, error: "Something went wrong. Try again." })
      .mockResolvedValueOnce({ ok: true, application: { id: 16 } });
    render(<RespondForm application={application([request({ id: 1 })])} />);

    await user.type(screen.getByLabelText("Your answer"), "Attached.");
    await user.upload(screen.getByLabelText("Upload your proof of income"), pdf());
    await user.click(screen.getByRole("button", { name: "Send response" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await user.click(screen.getByRole("button", { name: "Send response" }));

    expect(uploadLoanDocument).toHaveBeenCalledTimes(1);
    expect(respondToActionRequired).toHaveBeenLastCalledWith(expect.objectContaining({ documentIds: [77] }));
  });

  it("keeps earlier requests visible to the customer", () => {
    render(
      <RespondForm
        application={application([
          request({ id: 9, status: "responded", reason: "Upload a clearer ID.", response: { response_note: "Done.", responded_at: "2026-09-10T00:00:00Z", provided_document_ids: [5] } }),
          request({ id: 10 }),
        ])}
      />,
    );
    expect(screen.getByText("Earlier requests on this application (1)")).toBeInTheDocument();
    expect(screen.getByText(/You answered .*: “Done\.”/)).toBeInTheDocument();
  });
});
