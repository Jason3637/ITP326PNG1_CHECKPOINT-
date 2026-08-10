export interface Member {
  id: string;
  name: string;
  email: string;
  membershipSince: string;
  // Self-reported/verified business income — the basis for maxLoanAmount
  // under the income-multiplier eligibility model (Prime's Vault is
  // lending-only; there is no savings balance to derive eligibility from).
  monthlyIncome: number;
  maxLoanAmount: number;
  activeLoanId: string | null;
}

export interface Loan {
  id: string;
  memberId: string;
  amount: number;
  purpose: string;
  termMonths: number;
  monthlyPayment: number;
  totalRepayable: number;
  status: "pending" | "approved" | "rejected" | "active";
  frequency: "monthly" | "fortnightly";
}

export interface Transaction {
  id: string;
  memberId: string;
  type: "loan_disbursement" | "repayment" | "fee";
  amount: number;
  date: string;
  description: string;
}
