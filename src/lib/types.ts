export interface Member {
  id: string;
  name: string;
  email: string;
  savingsBalance: number;
  loanEligibility: number;
  createdAt: string;
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
  type: "deposit" | "withdrawal" | "loan_disbursement" | "repayment";
  amount: number;
  date: string;
  description: string;
}
