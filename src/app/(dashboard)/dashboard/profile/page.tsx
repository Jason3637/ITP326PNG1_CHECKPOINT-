import { redirect } from "next/navigation";
import { ShieldCheck, ShieldOff, User } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import type { Profile } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Audit (item 4): GET /api/users/profile returns
// { id, email, full_name, phone_number, role, is_active, totp_enabled,
// created_at }. Deliberately not rendered here: `role` and `is_active`
// (administrative account flags, not something the customer manages or
// needs to see) and `id` (an internal database key). `totp_enabled` is
// shown, since it's the customer's own account-security status, not an
// internal one. There is no PUT/PATCH endpoint, so this page is read-only.
export default async function ProfilePage() {
  let profile: Profile;
  try {
    profile = await serverApiFetch<Profile>("/users/profile");
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  return (
    <Card>
      <CardTitle>My profile</CardTitle>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
          <User className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-lg font-bold tracking-tight text-neutral-900">{profile.full_name}</p>
          <p className="text-sm text-neutral-600">Member since {formatDate(profile.created_at)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col divide-y divide-neutral-100 border-t border-neutral-100">
        {/* Email can be long enough to collide with its label at 375px in a
            single row (confirmed visually) - stacked below the label on
            narrow screens, back to a row at sm: and up. */}
        <div className="flex flex-col gap-0.5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="text-neutral-600">Email</span>
          <span className="break-all font-medium text-neutral-900">{profile.email}</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <span className="text-neutral-600">Mobile</span>
          <span className="font-medium text-neutral-900">{profile.phone_number ?? "Not on file"}</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <span className="text-neutral-600">Two-factor authentication</span>
          <span className="flex items-center gap-1.5 font-medium text-neutral-900">
            {profile.totp_enabled ? (
              <>
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                Enabled
              </>
            ) : (
              <>
                <ShieldOff className="h-4 w-4 text-danger" aria-hidden="true" />
                Not enabled
              </>
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
