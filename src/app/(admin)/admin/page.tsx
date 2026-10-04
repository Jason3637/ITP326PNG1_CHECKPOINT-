import { Card, CardTitle } from "@/components/ui/Card";

// The Administrator area's landing page. A placeholder until the admin
// dashboard (queues from GET /admin/queues) is built - kept to what's true
// today rather than links to screens that don't exist yet.
export default function AdminHomePage() {
  return (
    <Card>
      <CardTitle>Administrator</CardTitle>
      <p className="mt-2 text-sm text-neutral-600">
        Approvals, disbursements, repayment verification and settings will appear here as each screen is added.
      </p>
    </Card>
  );
}
