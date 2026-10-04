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
