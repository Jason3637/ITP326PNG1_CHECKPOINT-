import type {
  AdminAnalytics,
  AdminApplicationItem,
  AdminLoanItem,
  AdminQueue,
  AdminQueueCounts,
  AdminQueuePage,
  AdminRepaymentItem,
} from "@/lib/types";

export function applicationItem(id: number, overrides: Partial<AdminApplicationItem> = {}): AdminApplicationItem {
  return {
    id,
    status: "recommended_for_approval",
    customer_id: 100 + id,
    customer_name: `Customer ${id}`,
    amount_requested: 500,
    prime_category: "PRIME 2",
    total_repayable: 675,
    purpose_category: "business",
    submitted_at: "2026-09-20T00:00:00+00:00",
    assigned_officer_id: 7,
    assigned_officer_name: "Olive Officer",
    assigned_at: "2026-09-21T00:00:00+00:00",
    is_mine: false,
    open_information_requests: 0,
    latest_recommendation: "recommend_approval",
    returned_reason: null,
    recommendation: {
      id: 1,
      recommendation: "recommend_approval",
      officer_id: 7,
      officer_name: "Olive Officer",
      created_at: "2026-09-22T00:00:00+00:00",
    },
    decided_at: null,
    ...overrides,
  };
}

export function loanItem(id: number, overrides: Partial<AdminLoanItem> = {}): AdminLoanItem {
  return {
    loan_id: id,
    application_id: 50 + id,
    customer: { id: 200 + id, full_name: `Borrower ${id}`, email: `b${id}@test` },
    status: "active",
    prime_category: "PRIME 1",
    principal: 300,
    interest_amount: 150,
    original_total_due: 450,
    penalties: 0,
    verified_repayments: 0,
    outstanding: 450,
    disbursed_at: "2026-09-25T00:00:00+00:00",
    due_date: "2026-10-09",
    days_overdue: 0,
    ...overrides,
  };
}

export function repaymentItem(id: number, overrides: Partial<AdminRepaymentItem> = {}): AdminRepaymentItem {
  return {
    payment_id: id,
    loan_id: 30,
    customer: { id: 230, full_name: "Payer Person", email: "p@test" },
    amount_reported: 200,
    payment_date: "2026-10-03",
    payment_method: "bsp_mobile_banking",
    reference_number: "BSP-123",
    receipts: [{ id: 1 }],
    status: "reported",
    reported_at: "2026-10-03T02:00:00+00:00",
    loan_outstanding: 250,
    ...overrides,
  };
}

const KINDS: Record<AdminQueue, AdminQueuePage["kind"]> = {
  awaiting_decision: "application",
  awaiting_disbursement: "application",
  active_loans: "loan",
  due_today: "loan",
  due_this_week: "loan",
  overdue: "loan",
  repayments_awaiting_verification: "repayment",
};

export function queuePage(queue: AdminQueue, items: unknown[] = [], total = items.length): AdminQueuePage {
  return {
    queue,
    label: queue,
    kind: KINDS[queue],
    as_of: "2026-10-05",
    page: 1,
    per_page: 5,
    total,
    items,
  } as AdminQueuePage;
}

export function queueCounts(counts: Partial<Record<AdminQueue, number>> = {}): AdminQueueCounts {
  const queues = Object.fromEntries(
    (Object.keys(KINDS) as AdminQueue[]).map((k) => [k, { label: k, count: counts[k] ?? 0 }]),
  ) as AdminQueueCounts["queues"];
  return { as_of: "2026-10-05", queues };
}

const m = (value: number, definition: string) => ({ value, definition });

export function analytics(overrides: Partial<Record<string, number>> = {}): AdminAnalytics {
  return {
    window: { from: "2026-09-06", to: "2026-10-05", timezone: "Pacific/Port_Moresby", note: "" },
    as_of: "2026-10-05",
    currency: "PGK",
    disbursements: {
      loans_disbursed: m(overrides.loans_disbursed ?? 4, "Loans disbursed in the window."),
      principal_disbursed: m(overrides.principal_disbursed ?? 2100, "Sum of principal paid out in the window."),
      interest_contracted: m(700, "Interest."),
      expected_repayment: m(2800, "Expected."),
    },
    portfolio: {
      active_loans: m(overrides.active_loans ?? 3, "Open loans."),
      active_principal_exposure: m(900, "Exposure."),
      outstanding_value: m(overrides.outstanding_value ?? 1234.5, "What is still owed, from the ledger."),
      overdue_loans: m(1, "Overdue loans."),
      overdue_value: m(overrides.overdue_value ?? 310, "Outstanding balance on overdue loans."),
    },
  };
}

// GET /admin/loans/<id>, including fields the screens must never render
// (actor ids, storage paths) so tests can prove they don't leak.
export function loanDetail(overrides: Record<string, unknown> = {}) {
  return {
    loan_id: 5,
    application_id: 9,
    customer: { id: 230, full_name: "Simon Ere", email: "simon@customers.test" },
    status: "overdue",
    terms: {
      prime_category: "PRIME 2", principal: 600, interest_rate: 0.4, interest_amount: 240, original_total_due: 840,
      term_days: 14, disbursed_at: "2026-09-10T00:30:00+00:00", disbursed_local_date: "2026-09-10",
      due_date: "2026-09-24", pricing_version_id: 1, penalty_policy_version_id: 1,
    },
    balance: { original_obligation: 840, penalties: 60, verified_repayments: 300, outstanding: 600, days_overdue: 11 },
    disbursement: {
      id: 6, method: "cash_on_hand", amount: 600, reference: "CASH-ACK-0042", destination_masked: null,
      evidence_document_id: null, disbursed_at: "2026-09-10T00:30:00+00:00", recorded_at: "2026-09-10T00:31:00+00:00",
      recorded_by: 77, recorded_by_name: "Ada Admin", note: null,
    },
    closure: null,
    ledger: [
      { id: 11, entry_type: "verified_repayment", amount: -300, effective_date: "2026-09-20", created_at: null, created_by: 77, created_by_kind: "admin", disbursement_id: null, payment_transaction_id: 3, penalty_tier: null, note: "Matched on statement." },
      { id: 10, entry_type: "original_obligation", amount: 840, effective_date: "2026-09-10", created_at: null, created_by: 77, created_by_kind: "admin", disbursement_id: 6, payment_transaction_id: null, penalty_tier: null, note: null },
      { id: 12, entry_type: "penalty", amount: 60, effective_date: "2026-10-01", created_at: null, created_by: null, created_by_kind: "system", disbursement_id: null, payment_transaction_id: null, penalty_tier: 1, note: "7 days late: 25% of the original interest K240.00" },
    ],
    payments: [
      { id: 3, loan_id: 5, repayment_schedule_id: 1, amount: 300, payment_method: "bsp_mobile_banking", payment_date: "2026-09-20", reference_number: "BSP-1", status: "verified", rejection_reason: null, reported_at: "2026-09-20T01:00:00+00:00", paid_at: "2026-09-21T01:00:00+00:00", receipts: [{ id: 40, storage_path: "users/230/receipt/SECRET-PATH.pdf" }] },
      { id: 4, loan_id: 5, repayment_schedule_id: 1, amount: 200, payment_method: "cash", payment_date: "2026-10-03", reference_number: null, status: "reported", rejection_reason: null, reported_at: "2026-10-03T02:00:00+00:00", paid_at: null, receipts: [] },
      { id: 2, loan_id: 5, repayment_schedule_id: 1, amount: 900, payment_method: "bsp_mobile_banking", payment_date: "2026-09-15", reference_number: "BSP-0", status: "rejected", rejection_reason: "No such BSP transaction.", reported_at: "2026-09-15T01:00:00+00:00", paid_at: null, receipts: [] },
    ],
    audit_history: [
      { id: 1, action: "loan_disbursed", actor_id: 77, actor_role: "admin", entity_type: "Loan", entity_id: "5", details: { method: "cash_on_hand", method_reference: "CASH-ACK-0042", disbursement_id: 6, application_id: 9 }, created_at: "2026-09-10T00:31:00+00:00" },
      { id: 2, action: "payment_rejected", actor_id: 77, actor_role: "admin", entity_type: "PaymentTransaction", entity_id: "2", details: { loan_id: 5, reason: "No such BSP transaction." }, created_at: "2026-09-16T00:00:00+00:00" },
      { id: 3, action: "loan_penalty_applied", actor_id: null, actor_role: null, entity_type: "Loan", entity_id: "5", details: { tier: 1, amount: 60, storage_path: "never/shown" }, created_at: "2026-10-01T00:00:00+00:00" },
    ],
    ...overrides,
  };
}
