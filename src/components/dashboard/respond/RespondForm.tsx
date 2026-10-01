"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { uploadLoanDocument } from "@/lib/actions/documents";
import { respondToActionRequired } from "@/app/(dashboard)/dashboard/applications/[applicationId]/respond/actions";
import type { LoanApplication } from "@/lib/types";

interface RespondFormProps {
  application: LoanApplication;
}

// Item 2 (Phase 10 integration pass): the one gap in the customer-facing
// UI the review found - there was no way at all for a customer to respond
// to a CUSTOMER_ACTION_REQUIRED request except via the raw API. This covers
// the common case (an officer's note, plus optionally a re-uploaded
// document) without re-asking every field on the original application -
// see actions.ts for exactly what's sent.
export function RespondForm({ application }: RespondFormProps) {
  const router = useRouter();
  const [responseNote, setResponseNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!responseNote.trim()) {
      setError("Describe what you changed or are providing.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const documentIds: number[] = [];
      if (file) {
        setUploading(true);
        const form = new FormData();
        form.set("file", file);
        form.set("document_type", "id_verification");
        form.set("loan_application_id", String(application.id));
        const uploadResult = await uploadLoanDocument(form);
        setUploading(false);
        if (!uploadResult.ok) {
          setError(`Upload failed: ${uploadResult.error}`);
          setSubmitting(false);
          return;
        }
        documentIds.push(uploadResult.document.id);
      }

      const res = await respondToActionRequired({
        applicationId: application.id,
        responseNote,
        documentIds,
      });
      setSubmitting(false);

      if (res.ok) {
        setDone(true);
      } else {
        setError(res.error);
      }
    } catch {
      setUploading(false);
      setSubmitting(false);
      setError("Something went wrong. Try again.");
    }
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
        <div>
          <p className="font-display text-xl font-bold tracking-tight text-neutral-900">Response submitted</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-600">
            Your loan officer will review what you provided. Application #{application.id} is back under review.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/applications")}>Back to my applications</Button>
      </Card>
    );
  }

  return (
    <Card className="sm:p-8">
      <CardHeader>
        <CardTitle>Respond to your application</CardTitle>
      </CardHeader>

      <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning-light bg-warning-light/40 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-neutral-900">What your loan officer needs</p>
          <p className="mt-1 text-sm text-neutral-700">
            {application.action_required_note ?? "Additional information is needed before review can continue."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="response-note" className="text-sm font-medium text-neutral-700">
            Your response
          </label>
          <textarea
            id="response-note"
            rows={4}
            value={responseNote}
            onChange={(e) => setResponseNote(e.target.value)}
            placeholder="Describe what you're providing or have changed"
            className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
          />
        </div>

        <FileUploadField
          label="Updated document (optional)"
          hint="PDF, JPG, or PNG, up to 10 MB - only if you're providing a new document"
          value={file}
          onChange={setFile}
          disabled={submitting}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button size="lg" onClick={handleSubmit} disabled={submitting} className="mt-2">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {uploading ? "Uploading..." : "Submitting..."}
            </>
          ) : (
            "Submit response"
          )}
        </Button>
      </div>
    </Card>
  );
}
