import type { Loan, Member, Transaction } from "./types";

export const mockMember: Member = {
  id: "mem_001",
  name: "Sarah Kaupa",
  email: "sarah.kaupa@example.com",
  savingsBalance: 5000,
  loanEligibility: 7500,
  createdAt: "2024-02-14",
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
    status: "pending",
    frequency: "monthly",
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: "txn_001",
    memberId: "mem_001",
    type: "deposit",
    amount: 1200,
    date: "2026-02-10",
    description: "Fortnightly savings deposit",
  },
  {
    id: "txn_002",
    memberId: "mem_001",
    type: "deposit",
    amount: 800,
    date: "2026-03-24",
    description: "Fortnightly savings deposit",
  },
  {
    id: "txn_003",
    memberId: "mem_001",
    type: "withdrawal",
    amount: 300,
    date: "2026-05-02",
    description: "Withdrawal for school fees",
  },
  {
    id: "txn_004",
    memberId: "mem_001",
    type: "deposit",
    amount: 1500,
    date: "2026-06-15",
    description: "Savings top-up",
  },
  {
    id: "txn_005",
    memberId: "mem_001",
    type: "deposit",
    amount: 1800,
    date: "2026-07-28",
    description: "Fortnightly savings deposit",
  },
];
