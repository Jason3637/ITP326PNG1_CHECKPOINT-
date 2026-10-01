import { Card, CardTitle } from "@/components/ui/Card";

// Shell only - confirms the staff portal renders for a loan_officer/admin
// account. Review-queue content is built in a later phase, once the
// backend's officer endpoints are confirmed.
export default function StaffHomePage() {
  return (
    <Card>
      <CardTitle>Staff portal</CardTitle>
      <p className="mt-2 text-sm text-neutral-600">
        Loan review tools will appear here. You&apos;re signed in with staff access.
      </p>
    </Card>
  );
}
