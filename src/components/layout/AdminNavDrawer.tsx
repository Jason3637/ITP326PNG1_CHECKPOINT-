"use client";

import { AdminNav } from "./AdminNav";
import { NavDrawer } from "./NavDrawer";
import type { AdminNavCounts } from "@/lib/nav";

// The admin sidebar below lg (see NavDrawer).
export function AdminNavDrawer({ counts }: { counts: AdminNavCounts | null }) {
  return (
    <NavDrawer>
      <AdminNav counts={counts} />
    </NavDrawer>
  );
}
