import { describe, expect, it } from "vitest";
import { auditApiQuery, auditDetailRows, auditEntityHref, auditLabel, auditLogHref, auditSummary, parseAuditFilters } from "./audit-log";

describe("audit log filters", () => {
  it("keeps only valid values", () => {
    expect(parseAuditFilters({ role: "admin", actor: "12", action: "payment_verified", from: "2026-10-01", to: "2026-10-05" })).toEqual({
      role: "admin", actorId: "12", action: "payment_verified", from: "2026-10-01", to: "2026-10-05",
    });
    expect(parseAuditFilters({ role: "superuser", actor: "12a", action: "drop_tables", from: "yesterday" })).toEqual({
      role: null, actorId: null, action: null, from: null, to: null,
    });
  });

  it("sends each chosen day as the UTC instants of its Port Moresby start and end", () => {
    const q = new URLSearchParams(
      auditApiQuery({ role: "loan_officer", actorId: null, action: null, from: "2026-10-01", to: "2026-10-05" }, 2, 50),
    );
    expect(q.get("page")).toBe("2");
    expect(q.get("actor_role")).toBe("loan_officer");
    expect(q.get("date_from")).toBe("2026-09-30T14:00:00.000+00:00"); // Oct 1, 00:00 in Port Moresby
    expect(q.get("date_to")).toBe("2026-10-05T13:59:59.999+00:00"); // Oct 5, 23:59:59.999 in Port Moresby
  });

  it("builds shareable links", () => {
    expect(auditLogHref({ action: "loan_disbursed" }, 3)).toBe("/admin/audit-log?action=loan_disbursed&page=3");
    expect(auditLogHref({})).toBe("/admin/audit-log");
  });
});

describe("audit entries", () => {
  it("labels settings changes and summarises the version change", () => {
    expect(auditLabel("prime_pricing_version_created")).toBe("PRIME pricing changed");
    expect(auditSummary({ details: { before_version: "prime-v1", after_version: "prime-v2", note: "Rates review." } })).toBe(
      "prime-v1 → prime-v2 · “Rates review.”",
    );
  });

  it("never shows file paths or credential-like fields in the details", () => {
    const rows = auditDetailRows({ storage_path: "users/7/x.pdf", document_type: "receipt", access_token: "t", nested: { storage_path: "y", ok: 1 } });
    expect(rows).toEqual([["document type", "receipt"], ["nested", '{"ok":1}']]);
  });

  it("links an entry to its page when it has one", () => {
    expect(auditEntityHref({ entity_type: "Loan", entity_id: "5", details: null })).toBe("/admin/loans/5");
    expect(auditEntityHref({ entity_type: "LoanApplication", entity_id: "8", details: null })).toBe("/admin/applications/8");
    expect(auditEntityHref({ entity_type: "PaymentTransaction", entity_id: "3", details: { loan_id: 5 } })).toBe("/admin/loans/5/repayments/3");
    expect(auditEntityHref({ entity_type: "Document", entity_id: "9", details: null })).toBeNull();
  });
});
