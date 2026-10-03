"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { cn } from "@/lib/utils";
import { ID_DOCUMENT_TYPES, PROOF_OF_INCOME_THRESHOLD } from "@/lib/loan-wizard";
import { uploadLoanDocument } from "@/lib/actions/documents";
import type { WizardData } from "../LoanApplyWizard";
import type { Document } from "@/lib/types";

const selectClass = cn(
  "h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
);

interface DocumentUploadStepProps {
  data: WizardData;
  amount: number;
  existingIdDocument?: Document;
  existingIncomeDocument?: Document;
  onChange: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  onBack: () => void;
  onNext: () => void;
}

interface FormErrors {
  idType?: string;
  idFile?: string;
  refereeFullName?: string;
  refereeRelationship?: string;
  refereeMobile?: string;
  incomeFile?: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Item 3: don't force re-upload of a still-valid document. There's no
// expiry/status field on Document at all, so "still valid" is never
// decided automatically — the customer explicitly confirms it (item 2).
// Reusing an existing document does NOT re-link it to this new
// application (no PATCH endpoint exists to update its loan_application_id)
// — it stays associated with whatever it was uploaded under before, or
// unassociated. A loan officer reviewing the customer's full document list
// can still see it either way.
function ExistingDocumentChoice({
  phrase,
  document,
  choice,
  onChoose,
}: {
  // A full noun phrase, e.g. "an ID document" / "a proof of income
  // document" — avoids fiddly a/an logic for a single caller-supplied word.
  phrase: string;
  document: Document;
  choice: "reuse" | "upload" | null;
  onChoose: (choice: "reuse" | "upload") => void;
}) {
  if (choice === "reuse") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success bg-success-light px-3 py-2.5 text-sm">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <span className="flex-1 text-neutral-900">
          Using {phrase} on file from {formatDate(document.uploaded_at)}
        </span>
        <button
          type="button"
          onClick={() => onChoose("upload")}
          className="shrink-0 rounded text-sm font-medium text-primary hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  if (choice === "upload") return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-sm text-neutral-900">
        You have {phrase} on file from {formatDate(document.uploaded_at)}. Still current?
      </p>
      <div className="mt-2 flex gap-3">
        {/* bg-primary + white text measured borderline on contrast at
            text-sm elsewhere in this app (confirmed with axe-core) —
            bg-primary-dark is a safe 8:1, same fix applied consistently. */}
        <Button size="sm" onClick={() => onChoose("reuse")} className="bg-primary-dark hover:opacity-90">
          Yes, still current
        </Button>
        <Button variant="outline" size="sm" onClick={() => onChoose("upload")}>
          No, upload a new one
        </Button>
      </div>
    </div>
  );
}

export function DocumentUploadStep({
  data,
  amount,
  existingIdDocument,
  existingIncomeDocument,
  onChange,
  onBack,
  onNext,
}: DocumentUploadStepProps) {
  const [errors, setErrors] = useState<FormErrors>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Tracks whether the *currently selected* file has already been uploaded
  // successfully, so re-clicking Continue doesn't re-upload unchanged files.
  const [idUploaded, setIdUploaded] = useState(false);
  const [incomeUploaded, setIncomeUploaded] = useState(false);
  // null = not yet chosen (only relevant when an existing document exists).
  const [idChoice, setIdChoice] = useState<"reuse" | "upload" | null>(existingIdDocument ? null : "upload");
  const [incomeChoice, setIncomeChoice] = useState<"reuse" | "upload" | null>(
    existingIncomeDocument ? null : "upload",
  );

  const incomeRequired = amount >= PROOF_OF_INCOME_THRESHOLD;

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (idChoice === "reuse") {
      // Nothing to validate — reusing the existing document.
    } else {
      if (!data.idType) next.idType = "Select an ID type.";
      if (!data.idFile) next.idFile = "Upload a copy of your ID.";
    }
    if (!data.refereeFullName.trim()) next.refereeFullName = "Referee full name is required.";
    if (!data.refereeRelationship.trim()) next.refereeRelationship = "Referee relationship is required.";
    if (!data.refereeMobile.trim()) next.refereeMobile = "Referee mobile number is required.";
    // Always re-evaluated against the *current* amount — a prior
    // application's requirement (or lack of one) never carries over
    // (item 4).
    if (incomeRequired && incomeChoice !== "reuse" && !data.incomeFile) {
      next.incomeFile = `Proof of income is required for amounts of K${PROOF_OF_INCOME_THRESHOLD.toLocaleString()} or more.`;
    }
    return next;
  }

  async function handleContinue() {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setUploadError(null);
    setUploading(true);

    try {
      if (idChoice === "reuse") {
        onChange("idSource", "existing");
        onChange("idDocumentId", existingIdDocument?.id ?? null);
      } else if (!idUploaded && data.idFile) {
        const idForm = new FormData();
        // id_document_type is the real field. The "<type>-" filename prefix
        // is kept so a backend that predates the field still records it.
        idForm.set("file", new File([data.idFile], `${data.idType}-${data.idFile.name}`, { type: data.idFile.type }));
        idForm.set("document_type", "id_verification");
        idForm.set("id_document_type", data.idType);
        const idResult = await uploadLoanDocument(idForm);
        if (!idResult.ok) {
          setUploadError(`ID document: ${idResult.error}`);
          setUploading(false);
          return;
        }
        setIdUploaded(true);
        onChange("idSource", "new");
        onChange("idDocumentId", idResult.document.id);
      }

      if (incomeRequired) {
        if (incomeChoice === "reuse") {
          onChange("incomeSource", "existing");
          onChange("incomeDocumentId", existingIncomeDocument?.id ?? null);
        } else if (!incomeUploaded && data.incomeFile) {
          const incomeForm = new FormData();
          incomeForm.set("file", data.incomeFile);
          // "proof_of_income" is a real backend document_type now (added
          // alongside the K1,000-and-above requirement it enforces) - the
          // previous "loan_file" placeholder is no longer needed.
          incomeForm.set("document_type", "proof_of_income");
          const incomeResult = await uploadLoanDocument(incomeForm);
          if (!incomeResult.ok) {
            setUploadError(`Proof of income: ${incomeResult.error}`);
            setUploading(false);
            return;
          }
          setIncomeUploaded(true);
          onChange("incomeSource", "new");
          onChange("incomeDocumentId", incomeResult.document.id);
        }
      }

      setUploading(false);
      onNext();
    } catch {
      setUploadError("Couldn't upload your documents. Check your connection and try again.");
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-neutral-900">Document upload</h2>
        <p className="mt-1 text-sm text-neutral-500">Upload your ID, a referee, and proof of income if required.</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-neutral-900">ID document</p>

        {existingIdDocument && (
          <ExistingDocumentChoice
            phrase="an ID document"
            document={existingIdDocument}
            choice={idChoice}
            onChoose={setIdChoice}
          />
        )}

        {idChoice === "upload" && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="id-type" className="text-sm font-medium text-neutral-700">
                ID type
              </label>
              <select
                id="id-type"
                value={data.idType}
                onChange={(e) => {
                  onChange("idType", e.target.value as WizardData["idType"]);
                  setIdUploaded(false);
                }}
                className={selectClass}
              >
                <option value="" disabled>
                  Select ID type
                </option>
                {ID_DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {errors.idType && <p className="text-sm text-danger">{errors.idType}</p>}
            </div>

            <FileUploadField
              label="ID document file"
              required
              hint="PDF, JPG, or PNG, up to 10 MB"
              value={data.idFile}
              onChange={(file) => {
                onChange("idFile", file);
                setIdUploaded(false);
              }}
              error={errors.idFile}
              disabled={uploading}
            />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-900">Referee</p>
        <Input
          label="Full name"
          value={data.refereeFullName}
          onChange={(e) => onChange("refereeFullName", e.target.value)}
          error={errors.refereeFullName}
          placeholder="Jane Doe"
        />
        <Input
          label="Relationship to you"
          value={data.refereeRelationship}
          onChange={(e) => onChange("refereeRelationship", e.target.value)}
          error={errors.refereeRelationship}
          placeholder="Sibling, employer, friend, etc."
        />
        <Input
          label="Mobile number"
          type="tel"
          value={data.refereeMobile}
          onChange={(e) => onChange("refereeMobile", e.target.value)}
          error={errors.refereeMobile}
          placeholder="+675 7123 4567"
        />
        <Input
          label="Employer / organisation (optional)"
          value={data.refereeEmployer}
          onChange={(e) => onChange("refereeEmployer", e.target.value)}
          placeholder="ABC Trading Ltd"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-900">
          Proof of income {!incomeRequired && <span className="font-normal text-neutral-400">(optional)</span>}
        </p>

        {incomeRequired && existingIncomeDocument && (
          <ExistingDocumentChoice
            phrase="a proof of income document"
            document={existingIncomeDocument}
            choice={incomeChoice}
            onChoose={setIncomeChoice}
          />
        )}

        {(!incomeRequired || incomeChoice === "upload") && (
          <FileUploadField
            label="Proof of income file"
            required={incomeRequired}
            hint={
              incomeRequired
                ? `Required for amounts of K${PROOF_OF_INCOME_THRESHOLD.toLocaleString()} or more — PDF, JPG, or PNG, up to 10 MB`
                : "PDF, JPG, or PNG, up to 10 MB"
            }
            value={data.incomeFile}
            onChange={(file) => {
              onChange("incomeFile", file);
              setIncomeUploaded(false);
            }}
            error={errors.incomeFile}
            disabled={uploading}
          />
        )}
      </div>

      {uploadError && <p className="text-sm text-danger">{uploadError}</p>}

      <div className="mt-2 flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} disabled={uploading} className="flex-1">
          Back
        </Button>
        <Button size="lg" onClick={handleContinue} disabled={uploading} className="flex-1">
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Uploading...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </div>
  );
}
