import type { Loan, Member, Transaction } from "./types";

export const mockMember: Member = {
  id: "mem_001",
  name: "Sarah Kaupa",
  email: "sarah.kaupa@example.com",
  membershipSince: "2024-02-14",
  monthlyIncome: 2500,
  maxLoanAmount: 7500, // 3x monthlyIncome, co-op policy multiplier
  activeLoanId: "loan_001",
};

export const mockLoans: Loan[] = [
  {
    id: "loan_001",
    memberId: "mem_001",
    amount: 7500,
    purpose: "Trade store stock restock",
    termMonths: 12,
    monthlyPayment: 700,
    totalRepayable: 8400,
    status: "active",
    frequency: "monthly",
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: "txn_001",
    memberId: "mem_001",
    type: "repayment",
    amount: 700,
    date: "2026-05-05",
    description: "Loan repayment",
  },
  {
    id: "txn_002",
    memberId: "mem_001",
    type: "repayment",
    amount: 700,
    date: "2026-06-05",
    description: "Loan repayment",
  },
  {
    id: "txn_003",
    memberId: "mem_001",
    type: "repayment",
    amount: 700,
    date: "2026-07-05",
    description: "Loan repayment",
  },
  {
    id: "txn_004",
    memberId: "mem_001",
    type: "repayment",
    amount: 700,
    date: "2026-08-05",
    description: "Loan repayment",
  },
];
