import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { serverApiFetch, UnauthenticatedError, ApiError } from "@/lib/server-api";
import type { MeResponse } from "@/lib/types";

// Defense-in-depth alongside middleware.ts: middleware only checks that a
// session cookie exists; this is the authoritative check (also handles the
// transparent access-token refresh) and is what actually fetches the
// signed-in member's name for the header.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let me: MeResponse;
  try {
    me = await serverApiFetch<MeResponse>("/auth/me");
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login");
    }
    // A reachable-but-erroring backend (500, etc.) shouldn't render a blank
    // dashboard silently - send the member back to log in rather than show
    // broken chrome with no name/session confirmed.
    if (err instanceof ApiError) {
      redirect("/login");
    }
    throw err;
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header fullName={me.full_name} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-6">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
