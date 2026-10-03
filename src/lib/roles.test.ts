import { describe, expect, it } from "vitest";
import { homePathForRole, isStaffRole, roleLabel } from "./roles";
import { isNavItemActive } from "./nav";

describe("isStaffRole", () => {
  it("treats loan officers and admins as staff", () => {
    expect(isStaffRole("loan_officer")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
  });

  it("treats customers, missing and unknown values as not staff", () => {
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
    expect(isStaffRole("")).toBe(false);
    expect(isStaffRole("ADMIN")).toBe(false);
    expect(isStaffRole("superuser")).toBe(false);
  });
});

describe("homePathForRole", () => {
  it("sends staff to /staff and everyone else to /dashboard", () => {
    expect(homePathForRole("loan_officer")).toBe("/staff");
    expect(homePathForRole("admin")).toBe("/staff");
    expect(homePathForRole("customer")).toBe("/dashboard");
    expect(homePathForRole(null)).toBe("/dashboard");
  });
});

describe("roleLabel", () => {
  it("never shows the raw role value", () => {
    expect(roleLabel("loan_officer")).toBe("Loan Officer");
    expect(roleLabel("admin")).toBe("Admin");
  });
});

describe("isNavItemActive", () => {
  it("matches the member dashboard root exactly, not as a prefix", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard/loans", "/dashboard")).toBe(false);
  });

  it("keeps the single staff tab highlighted on every staff screen", () => {
    expect(isNavItemActive("/staff", "/staff")).toBe(true);
    expect(isNavItemActive("/staff/queues/under_review", "/staff")).toBe(true);
    expect(isNavItemActive("/staff/applications/8/customer-history", "/staff")).toBe(true);
    expect(isNavItemActive("/staffing", "/staff")).toBe(false);
  });

  it("matches other tabs on nested sub-routes", () => {
    expect(isNavItemActive("/staff/applications/7", "/staff/applications")).toBe(true);
    expect(isNavItemActive("/dashboard/loans/3/report-repayment", "/dashboard/loans")).toBe(true);
  });
});
