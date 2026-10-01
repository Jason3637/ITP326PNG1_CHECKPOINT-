"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { cn } from "@/lib/utils";
import { REPAYMENT_METHODS, type RepaymentMethod } from "@/lib/report-repayment";
import { uploadLoanDocument } from "@/lib/actions/documents";
import { reportRepayment } from "@/lib/actions/payments";

const selectClass = cn(
  "h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
);

interface ReportRepaymentFormProps {
  loanId: number;
  repaymentScheduleId: number;
}

interface FormErrors {
  amount?: string;
  datePaid?: string;
  otherDescription?: string;
}

export function ReportRepaymentForm({ loanId, repaymentScheduleId }: ReportRepaymentFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [datePaid, setDatePaid] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<RepaymentMethod>("bsp_mobile_banking");
  const [otherDescription, setOtherDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function validate(): FormErrors {
    const next: FormErrors = {};
    const amountNum = Number(amount);
    if (!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      next.amount = "Enter the amount you paid.";
    }
    if (!datePaid) next.datePaid = "Enter the date you paid.";
    if (method === "other" && !otherDescription.trim()) next.otherDescription = "Describe the payment method.";
    return next;
  }

  async function handleSubmit() {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // The receipt/screenshot is optional - a customer may not have a
      // photo of their payment. If provided, it's uploaded first (as a
      // "receipt" document) and linked by id to the reported payment.
      let documentIds: number[] | undefined;
      if (receipt) {
        const form = new FormData();
        form.set("file", receipt);
        form.set("document_type", "receipt");
        const uploadResult = await uploadLoanDocument(form);
        if (!uploadResult.ok) {
          setSubmitError(`Receipt upload: ${uploadResult.error}`);
          setSubmitting(false);
          return;
        }
        documentIds = [uploadResult.document.id];
      }

      const res = await reportRepayment({
        repayment_schedule_id: repaymentScheduleId,
        amount: Number(amount),
        payment_method: method === "other" ? otherDescription.trim() : method,
        payment_date: datePaid,
        reference_number: referenceNumber.trim() || undefined,
        document_ids: documentIds,
      });
      setSubmitting(false);

      if (res.ok) {
        setDone(true);
      } else {
        setSubmitError(res.error);
      }
    } catch {
      setSubmitting(false);
      setSubmitError("Couldn't submit your report. Try again.");
    }
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
        <div>
          <p className="font-display text-xl font-bold tracking-tight text-neutral-900">
            Repayment Reported — Awaiting Verification
          </p>
          <p className="mt-1 max-w-sm text-sm text-neutral-600">
            An admin will verify what you reported. Your outstanding balance stays exactly as it is now until
            it&apos;s verified — this hasn&apos;t changed your balance yet.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
      </Card>
    );
  }

  return (
    <Card className="sm:p-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">Report a repayment</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Loan #{loanId} — tell us what you paid. An admin verifies it before it&apos;s reflected in your balance.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <Input
          label="Amount paid (PGK)"
          type="number"
          inputMode="decimal"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          placeholder="500"
        />

        <Input
          label="Date paid"
          type="date"
          value={datePaid}
          onChange={(e) => setDatePaid(e.target.value)}
          error={errors.datePaid}
          max={new Date().toISOString().slice(0, 10)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="repayment-method" className="text-sm font-medium text-neutral-700">
            Payment method
          </label>
          <select
            id="repayment-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as RepaymentMethod)}
            className={selectClass}
          >
            {REPAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {method === "other" && (
          <Input
            label="Describe the payment method"
            value={otherDescription}
            onChange={(e) => setOtherDescription(e.target.value)}
            error={errors.otherDescription}
            placeholder="e.g. Bank transfer"
          />
        )}

        <Input
          label="Reference number (if applicable)"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="BSP transaction reference"
        />

        <FileUploadField
          label="Receipt or screenshot (optional)"
          hint="PDF, JPG, or PNG, up to 10 MB"
          value={receipt}
          onChange={setReceipt}
          disabled={submitting}
        />

        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <Button size="lg" onClick={handleSubmit} disabled={submitting} className="mt-2">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Submitting...
            </>
          ) : (
            "Report repayment"
          )}
        </Button>
      </div>
    </Card>
  );
}
