"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn, formatKina } from "@/lib/utils";
import { applyForLoan } from "@/app/(dashboard)/dashboard/loans/apply/actions";
import type { LoanApplication, RepaymentFrequency } from "@/lib/types";

const FREQUENCIES: { value: RepaymentFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "monthly", label: "Monthly" },
];

interface FormErrors {
  amount?: string;
  term?: string;
}

export function LoanApplyForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [termMonths, setTermMonths] = useState("12");
  const [frequency, setFrequency] = useState<RepaymentFrequency>("monthly");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LoanApplication | null>(null);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    const amountNum = Number(amount);
    if (!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      nextErrors.amount = "Enter a loan amount greater than 0.";
    }
    const termNum = Number(termMonths);
    if (!termMonths.trim() || !Number.isInteger(termNum) || termNum <= 0) {
      nextErrors.term = "Enter a whole number of months.";
    }
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    const res = await applyForLoan({
      amount_requested: Number(amount),
      purpose: purpose.trim() || undefined,
      term_months: Number(termMonths),
      repayment_frequency: frequency,
    });
    setSubmitting(false);

    if (res.ok) {
      setResult(res.application);
    } else {
      setSubmitError(res.error);
    }
  }

  if (result) {
    const evaluation = result.credit_evaluation_result;
    return (
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
        <div>
          <p className="font-display text-xl font-bold tracking-tight text-neutral-900">Application submitted</p>
          <p className="mt-1 text-sm text-neutral-500">
            Requested {formatKina(result.amount_requested)} over {result.term_months} months. Status:{" "}
            <span className="font-medium text-neutral-900">{result.status.replace(/_/g, " ")}</span>
          </p>
        </div>
        {evaluation && (
          <p className="max-w-sm text-xs text-neutral-400">
            {evaluation.disclaimer} (score: {evaluation.score}/100)
          </p>
        )}
        <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
      </Card>
    );
  }

  return (
    <Card className="sm:p-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">Apply for a loan</h1>
      <p className="mt-1 text-sm text-neutral-500">
        We&apos;ll review your application and get back to you. You can only have one open application at a time.
      </p>

      <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          label="Amount requested (PGK)"
          type="number"
          inputMode="decimal"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          placeholder="5000"
        />

        <Input
          label="Purpose (optional)"
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Working capital for market stall"
        />

        <Input
          label="Term (months)"
          type="number"
          inputMode="numeric"
          min={1}
          value={termMonths}
          onChange={(e) => setTermMonths(e.target.value)}
          error={errors.term}
          placeholder="12"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="repayment-frequency" className="text-sm font-medium text-neutral-700">
            Repayment frequency
          </label>
          <select
            id="repayment-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RepaymentFrequency)}
            className={cn(
              "h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
            )}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <Button type="submit" size="lg" disabled={submitting} className="mt-2">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Submitting...
            </>
          ) : (
            "Submit application"
          )}
        </Button>
      </form>
    </Card>
  );
}
